import assert from "node:assert/strict";
import { test } from "node:test";
import hexEditor from "../src/figures/kinds/hex-editor.ts";
import { asciiByte, hexByte, traceHexEditor } from "../src/figures/models/hex-editor.ts";

void test("byte replacements keep the buffer length and immutable history, including repeated writes", () => {
    const bytes = [0x48, 0x00, 0xff];
    const trace = traceHexEditor(bytes, [
        { op: "select", index: 2 },
        { op: "write", index: 0, value: 0x68 },
        { op: "write", index: 0, value: 0x48 },
    ]);
    assert.deepEqual(bytes, [0x48, 0x00, 0xff]);
    assert.deepEqual(
        trace.map((step) => step.after.bytes),
        [
            [0x48, 0x00, 0xff],
            [0x68, 0x00, 0xff],
            [0x48, 0x00, 0xff],
        ],
    );
    assert.deepEqual(
        trace.map((step) => step.after.selected),
        [2, 0, 0],
    );
    assert.ok(trace.every((step) => step.after.bytes.length === bytes.length));
    assert.equal(trace[1]?.before.bytes[0], 0x48);
});

void test("ASCII boundaries and hexadecimal formatting represent actual bytes", () => {
    assert.deepEqual([0, 0x1f, 0x20, 0x2e, 0x41, 0x7e, 0x7f, 0xff].map(asciiByte), [
        "·",
        "·",
        " ",
        ".",
        "A",
        "~",
        "·",
        "·",
    ]);
    assert.deepEqual([0, 1, 0xa, 0x7f, 0xff].map(hexByte), ["00", "01", "0A", "7F", "FF"]);
});

void test("hex editor validates byte values, action shapes, indices and address overflow", () => {
    assert.doesNotThrow(() => hexEditor.bind({ bytes: [0], baseOffset: 0xffffffff }));
    assert.doesNotThrow(() => hexEditor.bind({ bytes: [0, 255], actions: [] }));
    for (const bytes of [[], [256], [-1], [0.5], Array<number>(65).fill(0)])
    {
        assert.throws(() => hexEditor.bind({ bytes }), /props.bytes/u);
    }
    assert.throws(() => hexEditor.bind({ bytes: [0], selected: 1 }), /props.selected/u);
    assert.throws(
        () => hexEditor.bind({ bytes: [0, 1], baseOffset: 0xffffffff }),
        /props.baseOffset/u,
    );
    assert.throws(
        () => hexEditor.bind({ bytes: [0], actions: [{ op: "write", index: 1, value: 2 }] }),
        /props.actions\[0\].index/u,
    );
    assert.throws(
        () => hexEditor.bind({ bytes: [0], actions: [{ op: "write", index: 0, value: 256 }] }),
        /props.actions\[0\].value/u,
    );
    assert.throws(
        () => hexEditor.bind({ bytes: [0], actions: [{ op: "select", index: 0, value: 1 }] }),
        /props.actions\[0\].value/u,
    );
    assert.throws(
        () => hexEditor.bind({ bytes: [0], actions: [{ op: "insert", index: 0 }] }),
        /props.actions\[0\].op/u,
    );
    assert.throws(
        () => hexEditor.bind({ bytes: [0], actions: Array(13).fill({ op: "select", index: 0 }) }),
        /props.actions/u,
    );
    assert.throws(() => hexEditor.bind({ bytes: [0], typo: 1 }), /props.typo/u);
});
