import assert from "node:assert/strict";
import { test } from "node:test";
import { createCssVariablesTheme, createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { decodeConfig, runtimeFor } from "../src/playground/contracts.ts";
import { parseGrammars } from "../src/playground/grammar.ts";
import { formatValue, outputChannel } from "../src/playground/output.ts";
import { transpileTypeScript } from "../src/playground/transpile.ts";
import { pngFromBase64 } from "../src/playground/python-plots.ts";
import { pythonDistribution, supportedPackages, verifyPackage } from "../scripts/python-packages.mjs";

const grammar = {
	scopeName: "source.example", patterns: [
		{ include: "#keywords" }, { include: "source.values" },
		{ name: "string.quoted", begin: '"', end: '"' },
	],
	repository: { keywords: { name: "keyword.control", match: "\\bemit\\b" } },
};
const xml = '<?xml version="1.0"?><plist version="1.0"><dict><key>scopeName</key><string>source.values</string><key>patterns</key><array><dict><key>name</key><string>constant.numeric</string><key>match</key><string>[0-9]+</string></dict></array></dict></plist>';

void test("playground config infers supported runtimes and rejects malformed boundaries", () => {
	assert.equal(runtimeFor("JS"), "javascript");
	assert.equal(runtimeFor("ts"), "typescript");
	assert.equal(runtimeFor("py"), "python");
	assert.equal(runtimeFor("signal"), false);
	const config = { language: "signal", label: "Custom", runtime: false, timeout: 500, grammars: [], pythonPackages: [] };
	assert.deepEqual(decodeConfig(JSON.stringify(config)), config);
	for (const change of [{ runtime: "shell" }, { timeout: 0 }, { timeout: 60_001 }, { grammars: [null] }, { language: "" }, { grammars: Array.from({ length: 17 }, () => ({ filename: "x", content: "" })) }]) {
		assert.throws(() => decodeConfig(JSON.stringify({ ...config, ...change })));
	}
	assert.throws(() => decodeConfig(JSON.stringify({ ...config, grammars: [{ filename: "x", content: "x".repeat(1_000_001) }] })), /1 MB/);
	assert.throws(() => decodeConfig(JSON.stringify({ ...config, runtime: "python", pythonPackages: ["micropip"] })), /Only NumPy/);
	assert.throws(() => decodeConfig(JSON.stringify({ ...config, runtime: "python", pythonPackages: ["numpy", "numpy"] })), /unique/);
	assert.throws(() => decodeConfig(JSON.stringify({ ...config, pythonPackages: ["numpy"] })), /Python runtime/);
	assert.deepEqual(decodeConfig(JSON.stringify({ ...config, runtime: "python", pythonPackages: ["numpy", "seaborn"] })).pythonPackages, ["numpy", "seaborn"]);
});

void test("scientific packages resolve a closed, pinned dependency graph from official sources", () => {
	const distribution = pythonDistribution();
	for (const name of supportedPackages) assert.ok(Object.hasOwn(distribution.lock.packages, name));
	assert.equal(Object.hasOwn(distribution.lock.packages, "micropip"), false);
	for (const entry of distribution.files) {
		assert.match(entry.sha256, /^[a-f0-9]{64}$/);
		assert.ok(["cdn.jsdelivr.net", "files.pythonhosted.org"].includes(new URL(entry.url).hostname));
		assert.ok(entry.depends.every((name) => Object.hasOwn(distribution.lock.packages, name)));
	}
	const data = new TextEncoder().encode("abc");
	assert.equal(verifyPackage(data, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"), true);
	assert.equal(verifyPackage(data, "0".repeat(64)), false);
});

void test("plot transport rejects non-PNG data, oversized images and excess figures", () => {
	assert.throws(() => pngFromBase64(btoa("<svg onload=alert(1)>")), /PNG image/);
	assert.throws(() => pngFromBase64("A".repeat(5_333_337)), /4 MB/);
	const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
	assert.deepEqual(new Uint8Array(pngFromBase64(Buffer.from(header).toString("base64"))), header);
	const channel = new MessageChannel();
	try {
		const send = outputChannel(channel.port1);
		for (let index = 0; index < 8; index++) send({ type: "plot", png: header.slice().buffer, alt: "Plot" });
		assert.throws(() => { send({ type: "plot", png: header.slice().buffer, alt: "Excess plot" }); }, /Plot limit/);
	} finally { channel.port1.close(); channel.port2.close(); }
});

void test("TextMate parses JSON and XML and preserves repository and external include rules", async () => {
	const grammars = parseGrammars([{ filename: "example.json", content: JSON.stringify(grammar) }, { filename: "values.tmLanguage", content: xml }]);
	assert.equal(grammars[0]?.scopeName, "source.example");
	assert.equal(grammars[1]?.scopeName, "source.values");
	const highlighter = await createHighlighterCore({
		engine: createOnigurumaEngine(import("shiki/wasm")),
		themes: [createCssVariablesTheme()], langs: grammars,
	});
	try {
		const tokens = highlighter.codeToTokensBase('emit 42 "first\nsecond"', { lang: "custom-0", theme: "css-variables" });
		const all = tokens.flat();
		assert.ok(all.some((token) => token.content === "emit" && token.color?.includes("token-keyword")));
		assert.ok(all.some((token) => token.content === "42" && token.color?.includes("token-constant")));
		assert.ok(tokens[1]?.some((token) => token.content.includes("second") && token.color?.includes("token-string")), "begin/end scope must persist across lines");
		for (const token of all) assert.equal('emit 42 "first\nsecond"'.slice(token.offset, token.offset + token.content.length), token.content);
	} finally { highlighter.dispose(); }
});

void test("invalid or duplicate TextMate grammars fail with useful errors", () => {
	assert.throws(() => parseGrammars([{ filename: "broken.json", content: "{" }]));
	assert.throws(() => parseGrammars([{ filename: "empty.json", content: "{}" }]), /scopeName and patterns/);
	assert.throws(() => parseGrammars([{ filename: "a.json", content: JSON.stringify(grammar) }, { filename: "b.json", content: JSON.stringify(grammar) }]), /duplicate scope/);
});

void test("TypeScript compiles non-erasable syntax and preserves async ECMAScript modules", async () => {
	const code = transpileTypeScript("enum Count { Two = 2 }; const n: Count = Count.Two; export const result: number = await Promise.resolve(n * 3);");
	const loaded = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`) as { result: number };
	assert.equal(loaded.result, 6);
	assert.throws(() => transpileTypeScript("const = ;"), /1:/);
});

void test("console formatting and limits handle mixed values without interpreting HTML", () => {
	assert.equal(formatValue(undefined), "undefined");
	assert.equal(formatValue(42n), "42");
	assert.equal(formatValue('<img onerror="alert(1)">'), '<img onerror="alert(1)">');
	const circular: { value: bigint; self?: object } = { value: 2n };
	circular.self = circular;
	assert.match(formatValue(circular), /Circular/);
	assert.match(formatValue(circular), /2n/);
	const channel = new MessageChannel();
	try {
		const send = outputChannel(channel.port1);
		assert.throws(() => { send({ type: "output", level: "log", text: "x".repeat(64_001) }); }, /Output limit/);
	} finally { channel.port1.close(); channel.port2.close(); }
});
