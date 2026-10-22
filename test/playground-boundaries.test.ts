import assert from "node:assert/strict";
import { test } from "node:test";
import {
    decodeCellRequest,
    decodeHighlightRequest,
    decodeHighlightRelease,
    decodeHighlightResponse,
    decodeInputResponse,
    decodeRunRequest,
    decodeRunResponse,
    MAX_CODE,
    MAX_INPUT,
    MAX_PNG,
} from "../src/playground/contracts.ts";
import { parseGrammars } from "../src/playground/grammar.ts";
import { inputChannel } from "../src/playground/input.ts";
import { initializePythonRuntime } from "../src/playground/python-runtime.ts";
import type { JsonValue } from "../src/utils/json.ts";

void test("execution messages decode only complete, bounded transport values", () => {
    for (const value of [
        undefined,
        null,
        2,
        true,
        "ready",
        [],
        {},
        { type: "output", text: null, level: "log" },
        { type: "output", text: "hello", level: "debug" },
        { type: "output", text: "x".repeat(64_001), level: "log" },
        { type: "input", id: NaN, prompt: "" },
        { type: "input", id: 1, prompt: "x".repeat(1001) },
        { type: "error", text: {} },
        { type: "plot", png: new Uint8Array(8), alt: "Plot" },
        { type: "plot", png: new ArrayBuffer(8), alt: "Plot" },
        { type: "plot", png: new ArrayBuffer(MAX_PNG + 1), alt: "Plot" },
    ])
        assert.equal(decodeRunResponse(value), undefined);
    assert.deepEqual(decodeRunResponse({ type: "ready", ignored: 1 }), { type: "ready" });
    assert.deepEqual(decodeRunResponse({ type: "done" }), { type: "done" });
    assert.deepEqual(decodeRunResponse({ type: "status", text: "Loading" }), {
        type: "status",
        text: "Loading",
    });
    assert.deepEqual(decodeRunResponse({ type: "output", text: "", level: "log" }), {
        type: "output",
        text: "",
        level: "log",
    });
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
    assert.deepEqual(decodeRunResponse({ type: "plot", png, alt: "Plot" }), {
        type: "plot",
        png,
        alt: "Plot",
    });
});

void test("run requests require actual ports and valid source/package combinations", () => {
    const channel = new MessageChannel();
    try {
        const request = {
            code: "print(1)",
            runtime: "python",
            assets: "/runtime/",
            port: channel.port1,
            pythonPackages: ["numpy"],
            persistent: true,
        };
        assert.deepEqual(decodeRunRequest(request), request);
        for (const change of [
            { code: "x".repeat(MAX_CODE + 1) },
            { port: {} },
            { runtime: false },
            { pythonPackages: ["numpy", "numpy"] },
            { pythonPackages: [null] },
            { pythonPackages: ["bad\npackage"] },
            { assets: null },
            { persistent: "true" },
            { runtime: "javascript" },
        ])
            assert.equal(decodeRunRequest({ ...request, ...change }), undefined);
        assert.deepEqual(decodeCellRequest({ type: "run", code: "", pythonPackages: [] }), {
            type: "run",
            code: "",
            pythonPackages: [],
        });
        assert.equal(decodeCellRequest(null), undefined);
        assert.equal(decodeCellRequest({ type: "run", code: "", pythonPackages: {} }), undefined);
    } finally {
        channel.port1.close();
        channel.port2.close();
    }
});

void test("highlighting rejects malformed tokens, overlap, and invalid grammar requests", () => {
    const token = { from: 0, to: 5, color: "var(--shiki-foreground)", fontStyle: 0 };
    const response = { id: 1, name: "python", tokens: [token] };
    assert.deepEqual(decodeHighlightResponse(response), response);
    assert.deepEqual(decodeHighlightResponse({ id: 1, error: "Invalid grammar" }), {
        id: 1,
        error: "Invalid grammar",
    });
    for (const tokens of [
        [null],
        [{ ...token, from: -1 }],
        [{ ...token, to: 0 }],
        [{ ...token, fontStyle: 16 }],
        [{ ...token, color: [] }],
        [token, token],
        [{ ...token, to: MAX_CODE + 1 }],
    ])
        assert.equal(decodeHighlightResponse({ ...response, tokens }), undefined);
    const request = { id: 1, language: "python", code: "x = 2", grammars: [] };
    assert.deepEqual(decodeHighlightRequest(request), request);
    for (const change of [
        { id: Infinity },
        { document: -1 },
        { revision: "2" },
        { base: 0.5 },
        { grammars: [null] },
        { code: null },
        { grammars: [{ filename: "x", content: "x".repeat(1_000_001) }] },
    ])
        assert.equal(decodeHighlightRequest({ ...request, ...change }), undefined);
    const patch = { ...response, from: 0, to: 5 };
    assert.deepEqual(decodeHighlightResponse(patch), patch);
    for (const bounds of [{ from: 1, to: 5 }, { from: 0, to: 4 }, { from: 0 }, { to: 5 }]) {
        assert.equal(decodeHighlightResponse({ ...response, ...bounds }), undefined);
    }
    const followup = {
        id: 2,
        document: 1,
        revision: 3,
        base: 1,
        language: "python",
        code: "x = 3",
    };
    assert.deepEqual(decodeHighlightRequest(followup), followup);
    assert.equal(decodeHighlightRelease({ type: "release", document: 1 }), 1);
    assert.equal(decodeHighlightRelease({ type: "release", document: -1 }), undefined);
    assert.equal(decodeHighlightRelease({ type: "release", document: "1" }), undefined);
});

void test(
    "malformed or oversized input cannot consume a pending prompt",
    { timeout: 2000 },
    async () => {
        assert.equal(decodeInputResponse({ type: "input", id: 1, value: 42 }), undefined);
        const channel = new MessageChannel();
        const ask = inputChannel(channel.port1, () => undefined);
        try {
            const pending = ask();
            for (const value of [
                null,
                [],
                { type: "input", id: 1 },
                { type: "input", id: 1, value: "x".repeat(MAX_INPUT + 1) },
                { type: "input", id: 2, value: "stale" },
            ])
                channel.port2.postMessage(value);
            channel.port2.postMessage({ type: "input", id: 1, value: "accepted" });
            assert.equal(await pending, "accepted");
        } finally {
            channel.port1.close();
            channel.port2.close();
        }
    },
);

void test("TextMate validation traverses nested rules before the tokenizer sees them", () => {
    const parse = (patterns: JsonValue[]) =>
        parseGrammars([
            {
                filename: "custom.json",
                content: JSON.stringify({ scopeName: "source.custom", patterns }),
            },
        ]);
    for (const rule of [
        null,
        1,
        { match: 1 },
        { include: {} },
        { patterns: {} },
        { captures: [] },
        { captures: { 1: { name: 42 } } },
        { applyEndPatternLast: "yes" },
        { repository: { value: { patterns: [null] } } },
    ])
        assert.throws(() => parse([rule]), /grammar/);
    let nested: JsonValue = { match: "x" };
    for (let index = 0; index < 66; index++) nested = { patterns: [nested] };
    assert.throws(() => parse([nested]), /nesting/);
    const valid = parse([
        { begin: "a", end: "b", applyEndPatternLast: 1, beginCaptures: { 0: { name: "keyword" } } },
    ]);
    assert.equal(valid[0]?.patterns[0]?.applyEndPatternLast, true);
    assert.equal(valid[0].patterns[0].beginCaptures?.["0"]?.name, "keyword");
});

void test("Python runtime adapter validates exports and returned Python text", async () => {
    for (const module of [
        null,
        {},
        { loadPyodide: 1 },
        { loadPyodide: () => null },
        { loadPyodide: () => ({ runPython: 1 }) },
    ])
        await assert.rejects(initializePythonRuntime(module, {}), /Python/);
    const calls: string[] = [];
    const runtime = {
        runPython: (code: string) => (code === "imports" ? '["numpy"]' : 42),
        runPythonAsync: (code: string) => Promise.resolve(calls.push(code)),
        registerJsModule: (name: string) => {
            calls.push(name);
        },
        loadPackage: (name: string) => Promise.resolve(calls.push(name)),
        loadPackagesFromImports: (code: string) => Promise.resolve(calls.push(code)),
        loadedPackages: { numpy: "default channel" },
    };
    const python = await initializePythonRuntime(
        { loadPyodide: () => Promise.resolve(runtime) },
        {},
    );
    assert.equal(python.runPythonString("imports"), '["numpy"]');
    assert.throws(() => python.runPythonString("number"), /expected text/);
    assert.equal(python.isPackageLoaded("numpy"), true);
    assert.equal(python.isPackageLoaded("matplotlib"), false);
    await python.runPythonAsync("print(1)");
    await python.loadPackage("numpy", {});
    python.registerJsModule("_playground", {});
    assert.deepEqual(calls, ["print(1)", "numpy", "_playground"]);
});
