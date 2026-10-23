import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeScene, defineScene, layoutScene, sceneState } from "#src/figures/scene/model.ts";
import { symbolGroups, symbolNames } from "#src/figures/scene/symbols.ts";

const flow = defineScene({
    items: [
        { id: "client", label: "Client", visual: "browser" },
        { id: "api", label: "Application", visual: "server" },
        { id: "db", label: "Database", visual: "database" },
    ],
});

void test("all catalog symbols are valid author inputs", () => {
    assert.equal(symbolNames.length, 82);
    assert.equal(symbolGroups.length, 6);
    for (const visual of symbolNames) {
        assert.equal(
            decodeScene({ items: [{ id: "item", label: visual, visual }] }).items[0]?.visual,
            visual,
        );
    }
});

void test("automatic scene layouts keep every card inside bounds without overlaps", () => {
    for (const width of [258, 308, 500, 620, 720]) {
        for (const layout of ["flow", "grid", "stack", "cycle", "hierarchy"]) {
            for (let count = layout === "cycle" ? 3 : 1; count <= 16; count++) {
                const model = decodeScene({
                    layout,
                    items: Array.from({ length: count }, (_, i) => ({
                        id: `n${String(i)}`,
                        label: "긴 이름도 글자가 겹치지 않게 배치합니다",
                        detail: "Descriptions wrap before the animation starts.",
                        ...(layout === "hierarchy" && i > 0
                            ? { parent: `n${String(Math.floor((i - 1) / 3))}` }
                            : {}),
                    })),
                });
                const placed = layoutScene(width, model);
                for (const [i, a] of placed.items.entries()) {
                    const context = `${layout}, ${String(width)}px, ${String(count)} items`;
                    assert.ok(a.x >= 0 && a.y >= 0, context);
                    assert.ok(a.x + a.w <= width + 0.01, context);
                    assert.ok(a.y + a.h <= placed.height, context);
                    for (const b of placed.items.slice(i + 1)) {
                        const overlap =
                            Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
                            Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
                        assert.equal(overlap, false, context);
                    }
                }
                for (const route of placed.routes) {
                    assert.ok(
                        route.points.every(
                            (p) =>
                                Number.isFinite(p.x) &&
                                Number.isFinite(p.y) &&
                                p.x >= 0 &&
                                p.x <= width &&
                                p.y >= 0 &&
                                p.y <= placed.height,
                        ),
                    );
                }
            }
        }
    }
});

void test("flow and cycle connections follow input order and hierarchy follows parents", () => {
    const model = decodeScene(flow);
    assert.deepEqual(model.links, [
        { from: "client", to: "api" },
        { from: "api", to: "db" },
    ]);
    assert.deepEqual(decodeScene({ ...flow, layout: "cycle" }).links.at(-1), {
        from: "db",
        to: "client",
    });
    const hierarchy = decodeScene({
        layout: "hierarchy",
        items: [
            { id: "child", label: "Child", parent: "root" },
            { id: "leaf", label: "Leaf", parent: "child" },
            { id: "root", label: "Root" },
        ],
    });
    assert.deepEqual(
        hierarchy.items.map((item) => [item.id, item.depth]),
        [
            ["root", 0],
            ["child", 1],
            ["leaf", 2],
        ],
    );
    assert.deepEqual(hierarchy.links, [
        { from: "root", to: "child" },
        { from: "child", to: "leaf" },
    ]);
});

void test("scenes reject author mistakes instead of guessing a drawing", () => {
    assert.throws(() => decodeScene({ ...flow, layuot: "grid" }), /props.layuot/u);
    assert.throws(
        () => decodeScene({ items: [{ id: "x", label: "X", visual: "databse" }] }),
        /visual/u,
    );
    assert.throws(
        () =>
            decodeScene({
                items: [
                    { id: "x", label: "X" },
                    { id: "x", label: "Y" },
                ],
            }),
        /unique/u,
    );
    assert.throws(
        () => decodeScene({ ...flow, steps: [{ action: "focus", target: "typo" }] }),
        /missing id/u,
    );
    assert.throws(
        () => decodeScene({ ...flow, steps: [{ action: "transfer", from: "client", to: "db" }] }),
        /existing forward/u,
    );
    assert.throws(() => decodeScene({ ...flow, motion: "none", steps: [] }), /alternatives/u);
    assert.throws(
        () => decodeScene({ layout: "cycle", items: [{ id: "a", label: "A" }] }),
        /three/u,
    );
    assert.throws(
        () =>
            decodeScene({
                layout: "hierarchy",
                items: [
                    { id: "a", label: "A", parent: "b" },
                    { id: "b", label: "B", parent: "a" },
                ],
            }),
        /parent cycle/u,
    );
    assert.throws(
        () =>
            decodeScene({
                layout: "hierarchy",
                items: [{ id: "a", label: "A", parent: "missing" }],
            }),
        /missing id/u,
    );
});

void test("animation state is seekable and the final view retains every revealed item", () => {
    const model = decodeScene({ ...flow, motion: "reveal" });
    assert.equal(sceneState(model, 0).revealed.size, 0);
    assert.equal(sceneState(model, 8).revealed.size, 3);
    assert.deepEqual(sceneState(model, 3), sceneState(model, 3));
    assert.equal(sceneState(model, 8).target, "db");
    assert.equal(sceneState(model, 8).active, -1);
    assert.equal(sceneState(decodeScene(flow), 2).step?.action, "transfer");
    assert.equal(sceneState(decodeScene({ ...flow, motion: "none" }), 8).target, undefined);
});
