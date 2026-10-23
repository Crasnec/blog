import assert from "node:assert/strict";
import { test } from "node:test";

import { phases } from "#src/figures/kit.ts";
import gantt, { schedule } from "#src/figures/kinds/gantt.ts";
import { simulate } from "#src/figures/kinds/memory.ts";
import sort from "#src/figures/kinds/sort.ts";
import stateMachine from "#src/figures/kinds/state-machine.ts";
import tree from "#src/figures/kinds/tree.ts";
import type { JsonObject } from "#src/utils/json.ts";

void test("phase timing uses own durations and preserves the supplied workload", () => {
    const durations = { appear: 1, pause: 0, finish: 2 };
    Object.setPrototypeOf(durations, { inherited: 100 });

    assert.deepEqual(phases(durations), { appear: 0, pause: 1, finish: 1, end: 3 });
    assert.deepEqual(durations, { appear: 1, pause: 0, finish: 2 });
    assert.deepEqual(phases({}), { end: 0 });
});

void test("next-fit resumes inside a hole coalesced across its cursor", () => {
    const steps = simulate("next-fit", 16, [
        { op: "alloc", id: "A", size: 4 },
        { op: "alloc", id: "B", size: 4 },
        { op: "free", id: "B" },
        { op: "alloc", id: "C", size: 2 },
    ]);
    assert.deepEqual(steps.at(-1)?.after, [
        { id: "A", start: 0, size: 4 },
        { id: "C", start: 8, size: 2 },
    ]);
});

void test("next-fit wraps when the tail at its cursor is too small", () => {
    const steps = simulate("next-fit", 16, [
        { op: "alloc", id: "A", size: 8 },
        { op: "alloc", id: "B", size: 8 },
        { op: "free", id: "A" },
        { op: "alloc", id: "C", size: 4 },
        { op: "free", id: "C" },
        { op: "alloc", id: "D", size: 6 },
    ]);
    assert.deepEqual(steps.at(-1)?.after, [
        { id: "B", start: 8, size: 8 },
        { id: "D", start: 0, size: 6 },
    ]);
});

void test("round robin preserves service time and computes waiting time", () => {
    const plan = schedule(
        [
            { id: "A", arrive: 0, burst: 2 },
            { id: "B", arrive: 0, burst: 1 },
        ],
        "rr",
        1,
        1,
    );
    assert.equal(plan.end, 3);
    assert.equal(plan.switches, 2);
    assert.deepEqual(
        plan.outcomes.map(({ done, wait }) => ({ done, wait })),
        [
            { done: 3, wait: 1 },
            { done: 2, wait: 1 },
        ],
    );
    for (const [job, burst] of [2, 1].entries()) {
        const service = plan.slices
            .filter((s) => s.job === job)
            .reduce((total, s) => total + s.end - s.start, 0);
        assert.equal(service, burst);
    }
});

void test("a schedule that exceeds the event budget fails at the props boundary", () => {
    assert.throws(
        () =>
            gantt.bind({
                policy: "rr",
                quantum: 0.0001,
                jobs: [{ id: "A", arrive: 0, burst: 2 }],
            }),
        /exceeds 10000 events.*props\.quantum/u,
    );
});

void test("a schedule completing at the event limit still succeeds", () => {
    const plan = schedule([{ id: "A", arrive: 0, burst: 10_000 }], "rr", 1, 1);
    assert.equal(plan.end, 10_000);
    assert.equal(plan.outcomes[0]?.wait, 0);
});

for (const algorithm of ["bubble", "insertion", "quick", "merge"]) {
    void test(`${algorithm} automatically fits the largest supported input`, () => {
        assert.doesNotThrow(() => sort.bind({ algorithm, count: 40 }));
    });
}

void test("a degenerate BST with 15 nodes automatically fits its duration", () => {
    for (const sorted of ["asc", "desc"]) {
        assert.doesNotThrow(() =>
            tree.bind({
                operation: "bst-insert",
                values: { count: 15, sorted },
            }),
        );
    }
});

void test("explicit invalid or overlong steps still fail", () => {
    for (const step of [0, -1]) {
        assert.throws(
            () => sort.bind({ algorithm: "bubble", step }),
            /props\.step must be positive/u,
        );
        assert.throws(
            () => tree.bind({ operation: "bst-insert", values: [1, 2], step }),
            /props\.step must be positive/u,
        );
    }
    assert.throws(() => sort.bind({ algorithm: "bubble", count: 40, step: 1 }), /only 8\.0s fit/u);
    assert.throws(
        () => tree.bind({ operation: "bst-insert", values: { count: 15, sorted: "asc" }, step: 1 }),
        /figure has 8\.7s/u,
    );
});

const machine: JsonObject = {
    states: [
        { id: "A", label: "A", x: 0, y: 0.5 },
        { id: "B", label: "B", x: 0.5, y: 0.5 },
        { id: "C", label: "C", x: 1, y: 0.5 },
    ],
    events: [{ id: "go", label: "go" }],
    transitions: [
        { from: "A", to: "B", on: "go" },
        { from: "B", to: "C", on: "go" },
    ],
};

void test("state inputs cannot overlap an unfinished transition", () => {
    assert.throws(
        () =>
            stateMachine.bind({
                ...machine,
                inputs: [
                    { at: 1, event: "go" },
                    { at: 1.4, event: "go" },
                ],
            }),
        /props\.inputs\[1\].*at least 0\.55s/u,
    );
});

void test("state inputs exactly one transition apart are accepted", () => {
    assert.doesNotThrow(() =>
        stateMachine.bind({
            ...machine,
            inputs: [
                { at: 1, event: "go" },
                { at: 1.55, event: "go" },
                { at: 2.1, event: "go" },
            ],
        }),
    );
});
