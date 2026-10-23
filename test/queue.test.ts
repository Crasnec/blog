import assert from "node:assert/strict";
import { test } from "node:test";
import queue from "#src/figures/kinds/queue.ts";
import checkout from "#src/figures/kinds/checkout.ts";
import { simulateQueue } from "#src/figures/models/queue.ts";
import { prepareFigure } from "#src/figures/element.ts";

void test("dedicated queues and pooled FCFS replay the same workload without losing service", () => {
    const arrivals = [0, 0, 0, 1, 1, 2];
    const services = [8, 1, 1, 1, 1, 1];
    const dedicated = simulateQueue("per-server", arrivals, services, 2);
    const shared = simulateQueue("shared", arrivals, services, 2);
    assert.deepEqual(
        dedicated.map((v) => v.start),
        [0, 0, 8, 1, 2, 3],
    );
    assert.deepEqual(
        shared.map((v) => v.start),
        [0, 0, 1, 2, 3, 4],
    );
    for (const visits of [dedicated, shared]) {
        for (const [i, v] of visits.entries()) {
            assert.equal(v.end - v.start, services[i]);
            assert.ok(v.start >= v.arrive);
            const previous = visits
                .slice(0, i)
                .filter((p) => p.server === v.server)
                .at(-1);
            assert.ok(v.start >= (previous?.end ?? 0));
        }
    }
    assert.deepEqual(arrivals, [0, 0, 0, 1, 1, 2]);
    assert.deepEqual(services, [8, 1, 1, 1, 1, 1]);
});

void test("queue traces fit the animation independently of input time units", () => {
    const props = {
        servers: 2,
        arrivals: Array.from({ length: 14 }, () => 1e6),
        services: Array.from({ length: 14 }, () => 1e6),
    };
    assert.doesNotThrow(() => queue.bind(props));
    assert.equal(queue.bind(props).heightFor?.(340), 380);
    assert.doesNotThrow(() => queue.bind({ servers: 2, arrivals: [0], services: [1e-6] }));
    assert.doesNotThrow(() => checkout.bind({ registers: 2, customers: 14 }));
});

void test("queue rejects unschedulable input at the author boundary", () => {
    const valid = { servers: 2, arrivals: [0, 1], services: [1, 2] };
    for (const props of [
        { ...valid, servers: 2.5 },
        { ...valid, arrivals: [1, 0] },
        { ...valid, arrivals: [-1, 0] },
        { ...valid, services: [1] },
        { ...valid, services: [1, 0] },
        { ...valid, services: [1, 1e-320] },
        {
            ...valid,
            policies: [
                { policy: "shared", label: "A" },
                { policy: "shared", label: "B" },
            ],
        },
        { ...valid, highlight: { index: 2, label: "outside" } },
    ])
    {
        assert.throws(() => queue.bind(props), /props\./u);
    }
});

void test("shared element preparation validates before serializing author props", () => {
    const props = { servers: 2, arrivals: [0], services: [2] };
    const prepared = prepareFigure(queue, {
        kind: "queue",
        props,
        caption: "caption",
        label: "description",
        height: 420,
    });
    assert.equal(prepared.description, "description");
    assert.equal(prepared.serialized, JSON.stringify(props));
    assert.equal(prepared.height, 420);
    assert.equal(prepared.fixedHeight, true);
    for (const height of [0, -1, NaN, Infinity])
    {
        assert.throws(
            () => prepareFigure(queue, { kind: "queue", props, height }),
            /height must be a positive finite number/u,
        );
    }
    assert.throws(
        () => prepareFigure(queue, { kind: "queue", props: {} }),
        /<Figure kind="queue">: props\.servers/u,
    );
});
