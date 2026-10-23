import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeArea, decodeBar, decodePie } from "#src/figures/charts/model.ts";
import bar from "#src/figures/kinds/bar.ts";
import pie from "#src/figures/kinds/pie.ts";
import area from "#src/figures/kinds/area.ts";
import { prepareFigure } from "#src/figures/element.ts";

const series = [
    { label: "A", values: [30, -4, 0] },
    { label: "B", values: [20, 6, 0] },
    { label: "C", values: [-10, -3, 0] },
];
const categories = ["First", "Second", "Empty"];

void test("stacked bars accumulate signed values separately without changing their inputs", () => {
    const input = { categories, series, mode: "stacked" };
    const original = structuredClone(input);
    const model = decodeBar(input);
    assert.deepEqual(
        model.segments.map((s) => s[0]),
        [
            { from: 0, to: 30, value: 30 },
            { from: 30, to: 50, value: 20 },
            { from: 0, to: -10, value: -10 },
        ],
    );
    assert.deepEqual(
        model.segments.map((s) => s[1]),
        [
            { from: 0, to: -4, value: -4 },
            { from: 0, to: 6, value: 6 },
            { from: -4, to: -7, value: -3 },
        ],
    );
    assert.ok(model.domain.min <= -10 && model.domain.max >= 50);
    assert.deepEqual(input, original);
    const grouped = decodeBar({ categories, series });
    assert.ok(grouped.segments.flat().every((cell) => cell.from === 0));
});

void test("percentage bars normalize each category and keep zero totals empty", () => {
    const input = {
        categories: ["Total", "Empty"],
        mode: "percent",
        unit: "ms",
        series: [
            { label: "A", values: [3, 0] },
            { label: "B", values: [1, 0] },
        ],
    };
    const model = decodeBar(input);
    assert.deepEqual(model.segments, [
        [
            { from: 0, to: 75, value: 75 },
            { from: 0, to: 0, value: 0 },
        ],
        [
            { from: 75, to: 100, value: 25 },
            { from: 0, to: 0, value: 0 },
        ],
    ]);
    assert.deepEqual(model.domain.ticks, [0, 25, 50, 75, 100]);
    assert.deepEqual(bar.bind(input).table?.rows, [
        ["Total", 3, 1],
        ["Empty", 0, 0],
    ]);
    assert.throws(() => decodeBar({ categories, series, mode: "percent" }), /nonnegative/u);
});

void test("pie angles partition the total while a zero slice has no angle", () => {
    const input = {
        slices: [
            { label: "A", value: 3 },
            { label: "Zero", value: 0 },
            { label: "B", value: 1 },
        ],
    };
    const model = decodePie(input);
    assert.equal(model.total, 4);
    assert.deepEqual(
        model.slices.map((s) => [s.from, s.to, s.percent]),
        [
            [0, 0.75, 75],
            [0.75, 0.75, 0],
            [0.75, 1, 25],
        ],
    );
    assert.deepEqual(pie.bind(input).table?.rows, [
        ["A", 3, 75],
        ["Zero", 0, 0],
        ["B", 1, 25],
    ]);
    assert.throws(() => decodePie({ slices: [{ label: "A", value: 0 }] }), /positive total/u);
    assert.throws(() => decodePie({ slices: [{ label: "A", value: -1 }] }), /nonnegative/u);
});

void test("areas preserve irregular x positions and stack values at each sample", () => {
    const input = {
        x: [0, 1, 6],
        mode: "stacked",
        series: [
            { label: "A", values: [2, 3, 4] },
            { label: "B", values: [1, 2, 6] },
        ],
    };
    const model = decodeArea(input);
    assert.deepEqual(model.x, [0, 1, 6]);
    assert.deepEqual(model.segments[1], [
        { from: 2, to: 3, value: 1 },
        { from: 3, to: 5, value: 2 },
        { from: 4, to: 10, value: 6 },
    ]);
    assert.deepEqual(area.bind(input).table?.rows, [
        [0, 2, 1],
        [1, 3, 2],
        [6, 4, 6],
    ]);
    assert.equal(decodeArea({ ...input, mode: "percent" }).segments[1]?.at(-1)?.to, 100);
    assert.throws(() => decodeArea({ ...input, x: [0, 0, 6] }), /strictly increasing/u);
    assert.throws(() => decodeArea({ ...input, series }), /nonnegative/u);
    assert.doesNotThrow(() => decodeArea({ ...input, mode: "overlay", series }));
});

void test("constant, zero and small signed values keep a finite zero-based domain", () => {
    for (const value of [0, 5, -5, 1e-12, -1e12]) {
        const model = decodeBar({ categories: ["A"], series: [{ label: "B", values: [value] }] });
        assert.ok(model.domain.min < model.domain.max);
        assert.ok(model.domain.min <= Math.min(0, value));
        assert.ok(model.domain.max >= Math.max(0, value));
        assert.ok(model.domain.ticks.every(Number.isFinite));
    }
});

void test("malformed chart props fail at the author boundary with a field name", () => {
    const input = { categories, series };
    assert.throws(() => bar.bind({ ...input, orientation: "diagonal" }), /props.orientation/u);
    assert.throws(() => bar.bind({ ...input, showValues: "false" }), /props.showValues/u);
    assert.throws(() => bar.bind({ ...input, stacked: true }), /props.stacked/u);
    assert.throws(() => bar.bind({ ...input, categories: ["One"] }), /series\[0\].values/u);
    assert.throws(() => bar.bind({ ...input, categories: ["A", "A", "B"] }), /distinct/u);
    assert.throws(
        () => bar.bind({ ...input, series: [series[0] ?? {}, series[0] ?? {}] }),
        /distinct/u,
    );
    for (const value of [NaN, Infinity, 1e13, 1e-15]) {
        assert.throws(() => pie.bind({ slices: [{ label: "A", value }] }), /slices\[0\].value/u);
    }
    assert.throws(
        () => prepareFigure(bar, { kind: "bar", props: { categories: [] } }),
        /<Figure kind="bar">: props.categories/u,
    );
});
