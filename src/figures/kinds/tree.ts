/**
 * tree — a binary tree built, searched or heapified one real step at a time.
 *
 * `decode` actually runs the operation and records every step it takes:
 * each comparison on the way down a binary search tree, each new node
 * attached, each sift-up swap in a heap. `draw` replays that trace. The node
 * being compared is lit in the marker colour with the comparison written
 * beside it, the path taken so far is drawn as heavier edges, a new node grows
 * in, and the whole layout eases to its new shape as nodes arrive. Heights and
 * counts are read off the trace, so a tree built from sorted input really does
 * come out as tall as it has nodes.
 *
 *   <Figure kind="tree" props={{ operation: "bst-insert", values: [50, 30, 70, 20] }} />
 *
 * Props:
 *   operation  "bst-insert" | "bst-search" | "heap-insert" (required)
 *   values     2–15 whole numbers 0–99, distinct for a BST; or
 *              { count, seed?, sorted? } to generate them ("asc" or "desc")
 *   target     the value to look for; required for "bst-search", where the
 *              tree is built from `values` before the figure starts
 *   step       seconds per comparison; placing or swapping takes 1.6 times
 *              as long. Give two figures the same `step` to compare their
 *              speed. Default: whatever fits the trace into the figure.
 *   title      label shown top left (default: the operation's Korean name)
 */

import {
    along,
    canvasRect,
    clamp,
    defineFigure,
    dot,
    ease,
    label,
    line,
    maybe,
    num,
    obj,
    progress,
    ring,
    str,
    text,
    withAlpha,
    type Point,
} from "../kit.ts";
import type { JsonValue } from "../../utils/json.ts";

import { shuffledValues } from "../generators.ts";
import { traceTree as trace, type Operation, type Trace, type Placed } from "../models/tree.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    /** The tree (or the empty board) fades in. */
    appear: 0.6,
    /** The first step starts. */
    start: 0.8,
    /** Time kept after the last step for the totals to show. */
    tail: 1.5,
} as const;

const DURATION = 11;
const AVAILABLE = DURATION - TIMES.start - TIMES.tail;

/** Relative length of each kind of step; movement needs longer to be seen. */
const WEIGHT = { compare: 1, place: 1.6, swap: 1.6, found: 1.6, missing: 1.6 } as const;

/** Vertical room per tree level, in CSS pixels, before the canvas runs out. */
const LEVEL = 48;
const headerHeight = (narrow: boolean) => (narrow ? 54 : 34);

/* — 2. the trace ——————————————————————————————————————————————————————— */

function time(t: Trace, step: number): void {
    let at = TIMES.start;
    for (const s of t.steps) {
        s.start = at;
        at += WEIGHT[s.kind] * step;
        s.end = at;
    }
}

/* — 3. props ——————————————————————————————————————————————————————— */

interface Props {
    operation: Operation;
    title: string;
    trace: Trace;
}

const TITLES: Record<Operation, string> = {
    "bst-insert": "BST insertion",
    "bst-search": "BST search",
    "heap-insert": "Max-heap insertion",
};

function readValues(raw: JsonValue | undefined): number[] {
    if (Array.isArray(raw)) {
        return raw.map((v, i) => {
            const n = num(v, `props.values[${String(i)}]`);
            if (!Number.isInteger(n) || n < 0 || n > 99) {
                throw new Error(`props.values[${String(i)}] must be a whole number from 0 to 99`);
            }
            return n;
        });
    }
    const g = obj(raw, "props.values");
    const count = num(g.count, "props.values.count");
    if (!Number.isInteger(count) || count < 2 || count > 15) {
        throw new Error("props.values.count must be a whole number from 2 to 15");
    }
    const values = shuffledValues(
        Array.from({ length: 99 }, (_, i) => i + 1),
        maybe(g.seed, "props.values.seed", num) ?? 5,
    ).slice(0, count);
    const sorted = maybe(g.sorted, "props.values.sorted", str);
    if (sorted === "asc") values.sort((a, b) => a - b);
    else if (sorted === "desc") values.sort((a, b) => b - a);
    else if (sorted !== undefined) throw new Error('props.values.sorted must be "asc" or "desc"');
    return values;
}

export default defineFigure<Props>({
    duration: DURATION,
    height: 300,
    // One band per level, so a tall tree gets a tall canvas, within reason.
    heightFor: (width, props) =>
        clamp(headerHeight(width < 520) + (props.trace.maxDepth + 1) * LEVEL + 18, 200, 540),

    decode(raw) {
        const p = obj(raw, "props");
        const operation = str(p.operation, "props.operation");
        if (
            operation !== "bst-insert" &&
            operation !== "bst-search" &&
            operation !== "heap-insert"
        ) {
            throw new Error('props.operation must be "bst-insert", "bst-search" or "heap-insert"');
        }
        const values = readValues(p.values);
        if (values.length < 2 || values.length > 15) {
            throw new Error("props.values must have 2 to 15 numbers");
        }
        if (operation !== "heap-insert" && new Set(values).size !== values.length) {
            throw new Error("props.values must be distinct for a binary search tree");
        }
        const target = maybe(p.target, "props.target", num);
        if (operation === "bst-search" && target === undefined) {
            throw new Error('props.target is required for "bst-search"');
        }
        if (operation !== "bst-search" && target !== undefined) {
            throw new Error('props.target only applies to "bst-search"');
        }

        const t = trace(operation, values, target);
        const units = t.steps.reduce((sum, s) => sum + WEIGHT[s.kind], 0);
        const given = maybe(p.step, "props.step", num);
        const step = given ?? Math.min(AVAILABLE / Math.max(1, units), 0.6);
        if (step <= 0) throw new Error("props.step must be positive");
        if (units * step > AVAILABLE + 1e-9) {
            throw new Error(
                `props.step ${String(step)} needs ${(units * step).toFixed(1)}s, but the figure has ` +
                    `${AVAILABLE.toFixed(1)}s; use a step of at most ${(AVAILABLE / units).toFixed(3)}`,
            );
        }
        time(t, step);

        const title = maybe(p.title, "props.title", str) ?? TITLES[operation];
        return { operation, title, trace: t };
    },

    draw(frame, props) {
        const { ctx, width, height, time: now, palette } = frame;
        const { trace: t } = props;
        const narrow = width < 520;

        /* where we are in the trace */
        let k = -1;
        for (const [i, s] of t.steps.entries()) if (now >= s.start) k = i;
        const step = t.steps[k];
        const before = k > 0 ? (t.steps[k - 1]?.after ?? t.initial) : t.initial;
        const after = step?.after ?? t.initial;
        const p = step ? progress(now, step.start, step.end - step.start) : 0;
        const moving = step && (step.kind === "place" || step.kind === "swap");
        const blend = moving ? ease.inOut(p) : 1;
        const done = now >= (t.steps[t.steps.length - 1]?.end ?? 0);

        /* layout: header, then one band per level */
        const area = canvasRect(frame);
        const levels = t.maxDepth + 1;
        const count = Math.max(...[t.initial, ...t.steps.map((s) => s.after)].map((s) => s.size));
        const spanX = (area.w - 16) / Math.max(1, count);
        const header = headerHeight(narrow);
        const spanY = (height - header - 12) / levels;
        const r = clamp(Math.min(spanX * 0.42, spanY * 0.36, 17), 10, 17);
        const board = {
            x: area.x + r + 8,
            y: header + r + 2,
            w: area.w - 2 * r - 16,
            h: height - header - 2 * r - 10,
        };
        const dy = levels > 1 ? board.h / (levels - 1) : 0;
        const toPx = (n: Placed): Point => ({
            x: board.x + n.x * board.w,
            y: board.y + n.depth * dy,
        });
        const posOf = (id: number): Point | undefined => {
            const a = after.get(id);
            if (!a) return undefined;
            const b = before.get(id);
            return b ? along(toPx(b), toPx(a), blend) : toPx(a);
        };

        withAlpha(ctx, ease.out(progress(now, 0, TIMES.appear)), () => {
            /* layer 1: header — what this is, and how far it has got */
            text(frame, props.title, area.x, 14, {
                size: 12,
                weight: 700,
                color: palette.inkStrong,
            });
            const height_ = Math.max(-1, ...[...after.values()].map((n) => n.depth)) + 1;
            const stats = done
                ? props.operation === "bst-search"
                    ? `Comparisons ${String(t.lastComparisons)} · ${t.result === "찾음" ? "found" : "not found"}`
                    : `Height ${String(height_)} · nodes ${String(after.size)} · ${narrow ? "comp" : "comparisons"} ${String(step?.comparisons ?? 0)}`
                : `Height ${String(height_)} · ${narrow ? "comp" : "comparisons"} ${String(step?.comparisons ?? 0)}`;
            label(frame, stats, width, narrow ? 34 : 14, {
                size: narrow ? 11 : 12,
                weight: done ? 700 : 400,
                mono: true,
                color: done ? palette.marker : palette.inkMuted,
                maxX: width,
            });

            if (after.size === 0) {
                text(frame, "Empty tree", area.x + area.w / 2, board.y + 4, {
                    align: "center",
                    mono: true,
                    size: 11,
                    color: palette.inkFaint,
                });
            }

            /* layer 2: edges, with the path taken drawn heavier */
            const onPath = new Set<string>();
            if (step && !done) {
                for (let i = 1; i < step.path.length; i++) {
                    onPath.add(`${String(step.path[i - 1])}-${String(step.path[i])}`);
                    onPath.add(`${String(step.path[i])}-${String(step.path[i - 1])}`);
                }
            }
            // In a heap swap the slots stay put and only the values travel, so edges
            // are drawn between slots; elsewhere they follow the easing layout.
            const edgeAt = (id: number): Point | undefined => {
                if (step?.kind !== "swap") return posOf(id);
                const a = after.get(id);
                return a && toPx(a);
            };
            for (const [id, n] of after) {
                if (n.parent === undefined) continue;
                const a = edgeAt(n.parent);
                const b = edgeAt(id);
                if (!a || !b) continue;
                const lit = onPath.has(`${String(n.parent)}-${String(id)}`);
                const grow = step?.born === id ? ease.out(p) : 1;
                const end = along(a, b, grow);
                line(
                    ctx,
                    a.x,
                    a.y,
                    end.x,
                    end.y,
                    lit ? palette.marker : palette.rule,
                    lit ? 2.5 : 1.5,
                );
            }

            /* layer 3: nodes */
            const focus = new Set(step && !done ? step.focus : []);
            const pathSet = new Set(step && !done ? step.path : []);
            for (const [id, n] of after) {
                const at = posOf(id);
                if (!at) continue;
                const scale = step?.born === id ? ease.back(p) : 1;
                if (scale <= 0) continue;
                const rr = r * scale;
                const isFound = done && t.result === "찾음" && step?.focus[0] === id;
                const fill = isFound
                    ? palette.marker
                    : focus.has(id)
                        ? palette.markerWash
                        : palette.paper;
                dot(ctx, at.x, at.y, rr, fill);
                ring(
                    ctx,
                    at.x,
                    at.y,
                    rr,
                    focus.has(id) || isFound
                        ? palette.marker
                        : pathSet.has(id)
                            ? palette.inkMuted
                            : palette.rule,
                    focus.has(id) ? 2.5 : 1.5,
                );
                if (scale > 0.6) {
                    text(frame, String(n.value), at.x, at.y + 4, {
                        align: "center",
                        mono: true,
                        size: r >= 14 ? 12 : 11,
                        weight: 600,
                        color: isFound ? palette.paper : palette.inkStrong,
                    });
                }
            }

            /* layer 4: the comparison, written beside the node it is about */
            const note = step?.note;
            const about = step?.focus[0];
            if (note && about !== undefined && (!done || step.kind === "missing")) {
                const at = posOf(about);
                if (at) {
                    // Beside the node, on whichever side has room, never over it.
                    ctx.font = `700 11px ${palette.mono}`;
                    const w = ctx.measureText(note).width + 8;
                    const right = at.x + r + 6;
                    const x = right + w <= width - 2 ? right : Math.max(0, at.x - r - 6 - w);
                    label(frame, note, x, at.y + 4, {
                        mono: true,
                        size: 11,
                        weight: 700,
                        color: step.kind === "missing" ? palette.danger : palette.marker,
                        maxX: width,
                    });
                }
            }
        });
    },
});
