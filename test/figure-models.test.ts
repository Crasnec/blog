import assert from "node:assert/strict";
import { test } from "node:test";
import {
    traceSort,
    searchGrid,
    traceTree,
    planHashing,
    runMachine,
} from "../src/figures/models/index.ts";
import line from "../src/figures/kinds/line.ts";
import distribution from "../src/figures/kinds/distribution.ts";
import sort from "../src/figures/kinds/sort.ts";
import heatmap from "../src/figures/kinds/heatmap.ts";
import hashRing from "../src/figures/kinds/hash-ring.ts";
import { numberSamples, lognormalSamples } from "../src/figures/generators.ts";

void test("all sorting models order signed values and ties without mutating the workload", () => {
    for (const algorithm of ["bubble", "insertion", "quick", "merge"] as const) {
        const values = [-3, 2, 0, -3, 1.5];
        const trace = traceSort(algorithm, values);
        const ordered = values
            .map((value, id) => ({ value, slot: trace.final.slots[id] ?? -1 }))
            .sort((a, b) => a.slot - b.slot)
            .map((entry) => entry.value);
        assert.deepEqual(ordered, [-3, -3, 0, 1.5, 2]);
        assert.deepEqual(values, [-3, 2, 0, -3, 1.5]);
        assert.ok(trace.final.settled.every(Boolean));
        assert.doesNotThrow(() => sort.bind({ algorithm, values }));
    }
});

void test("grid search models work on a different maze and report unreachable goals", () => {
    const maze = {
        cols: 3,
        rows: 2,
        walls: [false, true, false, false, false, false],
        start: 0,
        goal: 5,
    };
    for (const algorithm of ["bfs", "dfs", "greedy", "astar"] as const) {
        assert.deepEqual(searchGrid(maze, algorithm).path, [0, 3, 4, 5]);
    }
    assert.deepEqual(
        searchGrid({ ...maze, walls: [false, true, false, true, true, false] }, "astar").path,
        [],
    );
});

void test("tree and state-machine models expose results without a canvas", () => {
    const found = traceTree("bst-search", [2, 1, 3], 3);
    assert.equal(found.steps.at(-1)?.kind, "found");
    assert.equal(found.lastComparisons, 2);
    assert.equal(traceTree("bst-search", [2, 1, 3], 4).steps.at(-1)?.kind, "missing");
    const transitions = [{ from: 0, to: 1, on: "advance", count: 2, label: "", bend: undefined }];
    const steps = runMachine(0, transitions, [
        { at: 0, event: "advance" },
        { at: 1, event: "reset" },
        { at: 2, event: "advance" },
        { at: 3, event: "advance" },
    ]);
    assert.deepEqual(
        steps.map((step) => step.fired),
        [undefined, undefined, undefined, 0],
    );
});

void test("real key names determine ownership and only the new ring server takes keys", () => {
    const names = ["user:42", "order:7", "cache:9", "user:108"];
    for (const scheme of ["ring", "modulo"] as const) {
        const plan = planHashing(scheme, ["node-a", "node-b"], "node-c", names, 4);
        assert.deepEqual(
            plan.keys.map((key) => key.name),
            names,
        );
        assert.equal(plan.moved, plan.keys.filter((key) => key.before !== key.after).length);
        assert.ok(
            plan.keys.every(
                (key) => key.before >= 0 && key.before < 2 && key.after >= 0 && key.after < 3,
            ),
        );
        if (scheme === "ring")
            assert.ok(
                plan.keys.filter((key) => key.before !== key.after).every((key) => key.after === 2),
            );
    }
    assert.doesNotThrow(() =>
        hashRing.bind({ scheme: "ring", servers: ["a", "b"], add: "c", keys: names }),
    );
    assert.throws(
        () =>
            hashRing.bind({
                scheme: "ring",
                servers: ["a", "b"],
                add: "c",
                keys: ["same", "same"],
            }),
        /distinct/u,
    );
});

void test("common numeric diagrams accept signed and constant data and reject invalid bounds", () => {
    for (const values of [
        [-4, 2, 0],
        [-3, -3],
        [0, 0],
        [1e-8, -1e-8],
    ]) {
        assert.doesNotThrow(() => line.bind({ series: [{ values }] }));
        assert.doesNotThrow(() =>
            distribution.bind({ groups: [{ label: "sample", samples: values }] }),
        );
        assert.doesNotThrow(() => sort.bind({ algorithm: "quick", values }));
    }
    assert.doesNotThrow(() =>
        heatmap.bind({ rows: ["any"], cols: ["a", "b"], values: [[-2, -2]] }),
    );
    assert.throws(() => line.bind({ series: [{ values: [-1, 2] }], yMin: 0 }), /enclose/u);
    assert.throws(
        () => distribution.bind({ groups: [{ samples: [1, 2] }], min: 2, max: 1 }),
        /max.*min/u,
    );
    assert.throws(
        () => distribution.bind({ groups: [{ samples: [1, 2] }], markers: [101] }),
        /percentile/u,
    );
});

void test("author-side sampling is reproducible and validates non-finite workloads", () => {
    assert.deepEqual(
        numberSamples(8, { seed: 2, min: -5, max: 5 }),
        numberSamples(8, { seed: 2, min: -5, max: 5 }),
    );
    assert.notDeepEqual(numberSamples(8, { seed: 2 }), numberSamples(8, { seed: 3 }));
    assert.deepEqual(lognormalSamples(8, 10, 0.2, 4), lognormalSamples(8, 10, 0.2, 4));
    assert.throws(() => numberSamples(2, { min: 2, max: 1 }), /bounds/u);
    assert.throws(() => lognormalSamples(2, 1, NaN, 4), /nonnegative/u);
});
