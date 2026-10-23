import assert from "node:assert/strict";
import { test } from "node:test";
import { decodePythonLock } from "#root/scripts/python-packages.mjs";
import type { JsonObject } from "#src/utils/json.ts";

const entry = {
    name: "example",
    version: "1.0",
    file_name: "example-1.0-py3-none-any.whl",
    sha256: "0".repeat(64),
    depends: ["numpy"],
    imports: ["example"],
    install_dir: "site",
    package_type: "package",
    tool: { source: "catalog" },
};

void test("Pyodide catalog decoding preserves package and runtime metadata", () => {
    const catalog = { info: { python: "3.14.2" }, packages: { example: entry } };
    assert.deepEqual(decodePythonLock(catalog), catalog);
    const named = { ...catalog, packages: { ["__proto__"]: entry } };
    assert.deepEqual(decodePythonLock(named), named);
    assert.ok(Object.hasOwn(decodePythonLock(named).packages, "__proto__"));
});

void test("Pyodide catalog decoding rejects malformed optional-download entries", () => {
    for (const catalog of [null, [], {}, { info: [], packages: {} }, { info: {}, packages: [] }]) {
        assert.throws(() => decodePythonLock(catalog), /Invalid Pyodide package catalog/);
    }
    const invalid: JsonObject[] = [
        { name: null },
        { version: 1 },
        { file_name: false },
        { sha256: [] },
        { depends: "numpy" },
        { depends: ["numpy", 1] },
        { imports: [null] },
        { install_dir: false },
        { package_type: {} },
    ];
    for (const change of invalid) {
        assert.throws(
            () => decodePythonLock({ info: {}, packages: { later: { ...entry, ...change } } }),
            /Invalid Pyodide package entry: later/,
        );
    }
});
