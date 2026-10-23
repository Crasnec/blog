import assert from "node:assert/strict";
import { test } from "node:test";
import {
    comparePostOrder,
    groupSeries,
    postNeighbours,
    seriesNeighbours,
    seriesPath,
    seriesSlug,
} from "#src/posts/series.ts";
import type { SeriesMetadata } from "#src/posts/post-order.ts";

function post(id: string, date: string, order?: number, series?: SeriesMetadata) {
    return {
        path: id,
        entry: { id, data: { published: new Date(date), order, series } },
    };
}

void test("global positions precede recent posts, with deterministic date and path ties", () => {
    const posts = [
        post("recent", "2026-10-22"),
        post("position-10", "2026-10-01", 10),
        post("position-2-old", "2026-10-01", 2),
        post("position-2-b", "2026-10-02", 2),
        post("older-b", "2026-10-20"),
        post("position-2-a", "2026-10-02", 2),
        post("older-a", "2026-10-20"),
    ];
    const expected = [
        "position-2-a",
        "position-2-b",
        "position-2-old",
        "position-10",
        "recent",
        "older-a",
        "older-b",
    ];
    assert.deepEqual(
        posts.toSorted(comparePostOrder).map(({ path }) => path),
        expected,
    );
    assert.deepEqual(
        posts
            .toReversed()
            .sort(comparePostOrder)
            .map(({ path }) => path),
        expected,
    );
});

void test("series ignore publication and global order, support gaps and stay within their boundary", () => {
    const first = post("Statistics/intro", "2026-10-22", 9, { name: "Think Stats", order: 1 });
    const middle = post("Examples/simulation", "2026-10-20", 1, { name: "Think Stats", order: 4 });
    const last = post("Statistics/summary", "2026-10-21", undefined, {
        name: "Think Stats",
        order: 10,
    });
    const unrelated = post("other", "2026-10-23", 2);
    const groups = groupSeries([last, unrelated, middle, first]);
    assert.equal(groups.length, 1);
    const series = groups[0];
    assert.ok(series);
    assert.equal(series.name, "Think Stats");
    assert.deepEqual(
        series.parts.map(({ order }) => order),
        [1, 4, 10],
    );
    assert.deepEqual(seriesNeighbours(series, first.entry.id), { prev: undefined, next: middle });
    assert.deepEqual(seriesNeighbours(series, middle.entry.id), { prev: first, next: last });
    assert.deepEqual(seriesNeighbours(series, last.entry.id), { prev: middle, next: undefined });
    assert.deepEqual(seriesNeighbours(series, unrelated.entry.id), {
        prev: undefined,
        next: undefined,
    });
    assert.deepEqual(groupSeries([unrelated]), []);
});

void test("series preserve Unicode names and reject ambiguous URLs and duplicate part numbers", () => {
    const korean = "운영체제 만들기";
    assert.equal(seriesSlug(korean), "운영체제-만들기");
    assert.equal(seriesPath(korean), `/series/${encodeURIComponent("운영체제-만들기")}/`);
    const unicode = groupSeries([
        post("first", "2026-10-21", undefined, { name: korean, order: 1 }),
    ]);
    assert.equal(unicode[0]?.name, korean);
    assert.throws(() => seriesSlug("  "), /nonempty URL slug/u);
    assert.throws(() => seriesSlug("+++"), /nonempty URL slug/u);
    assert.throws(
        () =>
            groupSeries([
                post("first", "2026-10-21", undefined, { name: "R&D", order: 1 }),
                post("second", "2026-10-22", undefined, { name: "RD", order: 2 }),
            ]),
        /share the URL/u,
    );
    assert.throws(
        () =>
            groupSeries([
                post("first", "2026-10-21", undefined, { name: "Think Stats", order: 1 }),
                post("second", "2026-10-22", undefined, { name: "Think Stats", order: 1 }),
            ]),
        /uses order 1 for both/u,
    );
    assert.throws(
        () =>
            groupSeries([
                post("first", "2026-10-21", undefined, { name: "Think Stats", order: 0 }),
            ]),
        /positive integer order/u,
    );
});

void test("standalone navigation follows manual listings, or older/newer without positions", () => {
    const first = post("first", "2026-10-20", 1);
    const second = post("second", "2026-10-21", 2);
    const latest = post("latest", "2026-10-22");
    const manual = [latest, second, first].sort(comparePostOrder);
    assert.deepEqual(postNeighbours(manual, "first"), { prev: undefined, next: second });
    assert.deepEqual(postNeighbours(manual, "second"), { prev: first, next: latest });
    assert.deepEqual(postNeighbours(manual, "latest"), { prev: second, next: undefined });
    const oldest = post("oldest", "2026-10-01");
    const chronological = [oldest, latest].sort(comparePostOrder);
    assert.deepEqual(postNeighbours(chronological, "latest"), { prev: oldest, next: undefined });
    assert.deepEqual(postNeighbours(chronological, "oldest"), { prev: undefined, next: latest });
    assert.deepEqual(postNeighbours(chronological, "missing"), {
        prev: undefined,
        next: undefined,
    });
});
