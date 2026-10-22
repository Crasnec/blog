/**
 * memory — a heap of fixed-size units and an allocator working through a list
 * of requests.
 *
 * `decode` runs a real allocator (first-fit, best-fit, worst-fit or next-fit)
 * over the requests and records the heap after every step. `draw` replays it:
 * the hole the policy picks lights up in the marker colour before the block
 * lands in it, freed blocks fade out, and a request that no hole can hold —
 * even though enough memory is free in total — bursts and leaves a badge
 * saying how much it needed and how big the largest hole was. That last case
 * is external fragmentation, and it is the point of most figures of this kind.
 *
 *   <Figure kind="memory" props={{ policy: "first-fit", heap: 32, requests: [
 *     { op: "alloc", id: "A", size: 5 }, { op: "free", id: "A" }, …
 *   ] }} />
 *
 * Props:
 *   policy    "first-fit" | "best-fit" | "worst-fit" | "next-fit" (required)
 *   heap      heap size in units, 8–64 (default 32)
 *   requests  { op: "alloc", id, size } | { op: "free", id }, in order.
 *             Freeing a request that failed is allowed and does nothing;
 *             freeing an unknown or already freed id fails the build.
 *   count     when `requests` is absent: how many to generate (default 12)
 *   seed      seed for generated requests (default 1)
 *   title     label shown top left (default: the policy name)
 */

import {
    badge,
    box,
    burst,
    canvasRect,
    clamp,
    defineFigure,
    ease,
    label,
    maybe,
    num,
    obj,
    arr,
    progress,
    str,
    text,
    withAlpha,
    type Frame,
    type Rect,
} from "../kit.ts";

import {
    simulate,
    holesOf,
    type Policy,
    type Request,
    type Step,
    type Hole,
} from "../models/memory.ts";
export { simulate } from "../models/memory.ts";

import { generateRequests } from "../generators.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    /** The empty heap and the request strip fade in. */
    appear: 0.6,
    /** The first request starts. */
    start: 0.8,
    /** Seconds per request, at most; long lists get less. */
    maxStep: 0.85,
    /** Time kept after the last request for the result to show. */
    tail: 1.4,
} as const;

const DURATION = 10;

/* — 2. the allocator ————————————————————————————————————————————————— */

const POLICIES: readonly Policy[] = ["first-fit", "best-fit", "worst-fit", "next-fit"];
const POLICY_NAMES: Record<Policy, string> = {
    "first-fit": "First fit",
    "best-fit": "Best fit",
    "worst-fit": "Worst fit",
    "next-fit": "Next fit",
};

/** A plausible request list: allocations of 2–8 units with frees mixed in. */

/* — 3. props ————————————————————————————————————————————————————————— */

interface Props {
    policy: Policy;
    title: string;
    heap: number;
    steps: Step[];
    step: number;
}

/** Heap rows: units per row so that a unit is at least `minUnit` px wide. */
function rowsFor(width: number, heap: number): { perRow: number; rows: number } {
    const minUnit = width < 520 ? 14 : 16;
    const rows = Math.max(1, Math.ceil(heap / Math.max(1, Math.floor(width / minUnit))));
    return { perRow: Math.ceil(heap / rows), rows };
}

const ROW_H = 44;
const ROW_GAP = 22;
const TOP = 74;
const BOTTOM = 40;

export default defineFigure<Props>({
    duration: DURATION,
    height: 200,
    heightFor: (width, props) => {
        const { rows } = rowsFor(width, props.heap);
        // A line of its own for the failure badge, when there is one to show.
        const badgeLine = props.steps.some((s) => s.failed) ? 28 : 0;
        return (
            TOP +
            rows * ROW_H +
            (rows - 1) * ROW_GAP +
            16 +
            BOTTOM +
            badgeLine +
            (width < 520 ? 22 : 0)
        );
    },

    decode(raw) {
        const p = obj(raw, "props");
        const policyRaw = str(p.policy, "props.policy");
        const policy = POLICIES.find((x) => x === policyRaw);
        if (!policy) throw new Error(`props.policy must be one of ${POLICIES.join(", ")}`);
        const heap = maybe(p.heap, "props.heap", num) ?? 32;
        if (!Number.isInteger(heap) || heap < 8 || heap > 64)
            throw new Error("props.heap must be a whole number from 8 to 64");

        let requests: Request[];
        if (p.requests === undefined) {
            const count = maybe(p.count, "props.count", num) ?? 12;
            if (!Number.isInteger(count) || count < 1 || count > 24)
                throw new Error("props.count must be a whole number from 1 to 24");
            requests = generateRequests(count, maybe(p.seed, "props.seed", num) ?? 1);
        } else {
            requests = arr(p.requests, "props.requests").map((r, i) => {
                const path = `props.requests[${String(i)}]`;
                const o = obj(r, path);
                const op = str(o.op, `${path}.op`);
                const id = str(o.id, `${path}.id`);
                if (id.length === 0 || id.length > 3)
                    throw new Error(`${path}.id must be 1–3 characters`);
                if (op === "free") return { op, id };
                if (op !== "alloc") throw new Error(`${path}.op must be "alloc" or "free"`);
                const size = num(o.size, `${path}.size`);
                if (!Number.isInteger(size) || size <= 0)
                    throw new Error(`${path}.size must be a positive whole number`);
                return { op, id, size };
            });
        }
        if (requests.length === 0 || requests.length > 24)
            throw new Error("props.requests must have 1 to 24 entries");

        const steps = simulate(policy, heap, requests);
        const step = Math.min(TIMES.maxStep, (DURATION - TIMES.start - TIMES.tail) / steps.length);
        return {
            policy,
            title: maybe(p.title, "props.title", str) ?? POLICY_NAMES[policy],
            heap,
            steps,
            step,
        };
    },

    draw(frame, props) {
        const { ctx, width, time, palette } = frame;
        const narrow = width < 520;
        const area = canvasRect(frame);
        const { steps, step, heap } = props;

        /* where we are: `k` requests are done, the next one is `frac` of the way */
        const elapsed = (time - TIMES.start) / step;
        const k = clamp(Math.floor(elapsed), 0, steps.length);
        const frac = time < TIMES.start || k >= steps.length ? 0 : elapsed - k;
        const current = steps[k];
        const settled = k === 0 ? [] : (steps[k - 1]?.after ?? []);
        const done = time >= TIMES.start + steps.length * step;

        /* layout */
        const { perRow, rows } = rowsFor(width, heap);
        const unitW = area.w / perRow;
        const rowY = (r: number) => TOP + r * (ROW_H + ROW_GAP);
        /** The on-screen pieces of a run of units, one per heap row it touches. */
        const pieces = (start: number, size: number): Rect[] => {
            const out: Rect[] = [];
            for (let r = 0; r < rows; r++) {
                const a = Math.max(start, r * perRow);
                const b = Math.min(start + size, (r + 1) * perRow);
                if (b > a)
                    out.push({
                        x: (a - r * perRow) * unitW,
                        y: rowY(r),
                        w: (b - a) * unitW,
                        h: ROW_H,
                    });
            }
            return out;
        };

        withAlpha(ctx, ease.out(progress(time, 0, TIMES.appear)), () => {
            /* layer 1: header */
            text(frame, props.title, 0, 14, { size: 12, weight: 700, color: palette.inkStrong });
            text(frame, `Heap ${String(heap)} cells`, width, 14, {
                align: "right",
                mono: true,
                size: 11,
                color: palette.inkFaint,
            });

            /* layer 2: the request strip, windowed so the current one is visible */
            drawRequests(frame, props, k, frac, done);

            /* layer 3: the empty heap, unit by unit, with addresses */
            for (let r = 0; r < rows; r++) {
                const count = Math.min(perRow, heap - r * perRow);
                for (let u = 0; u < count; u++) {
                    // ruleFaint rather than surface: it stays visible on a dark page.
                    ctx.fillStyle = palette.ruleFaint;
                    ctx.fillRect(u * unitW + 1, rowY(r) + 1, unitW - 2, ROW_H - 2);
                }
                const marks = narrow ? [0, count] : [0, Math.round(count / 2), count];
                for (const m of marks) {
                    const addr = r * perRow + m;
                    text(frame, String(addr), m * unitW, rowY(r) + ROW_H + 13, {
                        align: m === 0 ? "left" : m === count ? "right" : "center",
                        mono: true,
                        size: 11,
                        color: palette.inkFaint,
                    });
                }
            }

            /* layer 4: blocks — the settled heap, minus whatever is being freed */
            const freeing = current?.request.op === "free" && frac > 0 ? current.block : undefined;
            for (const b of settled) {
                if (b === freeing) continue;
                drawBlock(frame, pieces(b.start, b.size), b.id, palette.inkMuted, 1);
            }

            /* layer 5: the request in progress */
            if (current && frac > 0) {
                if (current.request.op === "alloc" && current.hole && current.block) {
                    // The chosen hole first, then the block landing in it.
                    const look = progress(frac, 0, 0.45);
                    withAlpha(ctx, Math.min(1, look * 2) * (1 - progress(frac, 0.75, 0.25)), () => {
                        for (const p of pieces(current.hole?.start ?? 0, current.hole?.size ?? 0)) {
                            box(
                                ctx,
                                p.x + 1,
                                p.y + 1,
                                p.w - 2,
                                p.h - 2,
                                3,
                                palette.markerWash,
                                palette.marker,
                                2,
                            );
                        }
                    });
                    const land = ease.out(progress(frac, 0.4, 0.45));
                    if (land > 0)
                        drawBlock(
                            frame,
                            pieces(current.block.start, current.block.size),
                            current.block.id,
                            palette.marker,
                            land,
                        );
                } else if (current.request.op === "free" && current.block) {
                    drawBlock(
                        frame,
                        pieces(current.block.start, current.block.size),
                        current.block.id,
                        palette.inkMuted,
                        1 - ease.inOut(frac),
                    );
                } else if (current.failed) {
                    const largest = holesOf(settled, heap).reduce<Hole | undefined>(
                        (m, h) => (!m || h.size > m.size ? h : m),
                        undefined,
                    );
                    const at = largest ? pieces(largest.start, largest.size)[0] : undefined;
                    if (at)
                        burst(
                            ctx,
                            at.x + at.w / 2,
                            at.y + at.h / 2,
                            progress(frac, 0.15, 0.8),
                            palette.danger,
                        );
                }
            }

            /* layer 6: the result row — live values, then the verdict */
            const now = done ? (steps[steps.length - 1]?.after ?? []) : settled;
            const holes = holesOf(now, heap);
            const free = holes.reduce((s, h) => s + h.size, 0);
            const largest = Math.max(0, ...holes.map((h) => h.size));
            const used = heap - free;
            const footY = rowY(rows - 1) + ROW_H + 40;
            text(
                frame,
                narrow
                    ? `Used ${String(used)} · free ${String(free)} · largest ${String(largest)}`
                    : `Used ${String(used)} · free ${String(free)} · largest free block ${String(largest)}`,
                0,
                footY,
                { mono: true, size: 11, color: palette.inkMuted },
            );

            const failure = steps.slice(0, k + (frac > 0.3 ? 1 : 0)).find((s) => s.failed)?.failed;
            if (failure) {
                // Stays up for the rest of the figure, on its own line under the
                // values: it is the result, and nothing else may sit under it.
                badge(
                    frame,
                    `Failed: need ${String(failure.needed)}, largest free ${String(failure.largest)}`,
                    0,
                    footY + (narrow ? 50 : 28),
                    palette.danger,
                    "left",
                );
            }
            const verdict = progress(time, TIMES.start + steps.length * step + 0.2, 0.5);
            if (verdict > 0) {
                const frag = free === 0 ? 0 : 1 - largest / free;
                withAlpha(ctx, verdict, () => {
                    label(
                        frame,
                        `Fragmented ${String(Math.round(frag * 100))}%`,
                        width,
                        footY + (narrow ? 22 : 0),
                        {
                            size: 12,
                            weight: 700,
                            mono: true,
                            color: failure ? palette.danger : palette.marker,
                            maxX: width,
                        },
                    );
                });
            }
        });
    },
});

/* — 4. parts ————————————————————————————————————————————————————————— */

/** A block's pieces, with its id inside the widest piece if it fits there. */
function drawBlock(frame: Frame, parts: Rect[], id: string, fill: string, alpha: number) {
    const { ctx, palette } = frame;
    withAlpha(ctx, alpha, () => {
        for (const p of parts) box(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, 3, fill, null);
        const widest = parts.reduce<Rect | undefined>(
            (m, p) => (!m || p.w > m.w ? p : m),
            undefined,
        );
        ctx.font = `700 12px ${palette.mono}`;
        if (widest && ctx.measureText(id).width + 8 <= widest.w) {
            text(frame, id, widest.x + widest.w / 2, widest.y + widest.h / 2 + 4, {
                align: "center",
                mono: true,
                size: 12,
                weight: 700,
                color: palette.paper,
            });
        }
    });
}

/**
 * The requests as a row of chips: `+A 5` to allocate, `−A` to free. Done ones
 * are faint, the current one has a marker border, a failed one is in danger.
 * When they do not all fit, the row scrolls to keep the current one in view.
 */
function drawRequests(frame: Frame, props: Props, k: number, frac: number, done: boolean) {
    const { ctx, width, palette } = frame;
    const y = 34;
    const h = 22;
    const gap = 6;
    ctx.font = `600 11px ${palette.mono}`;
    const chips = props.steps.map((s) => {
        const t =
            s.request.op === "alloc"
                ? `+${s.request.id} ${String(s.request.size)}`
                : `−${s.request.id}`;
        return { s, t, w: ctx.measureText(t).width + 14 };
    });
    const xs: number[] = [];
    let at = 0;
    for (const c of chips) {
        xs.push(at);
        at += c.w + gap;
    }
    const total = at - gap;
    const focus =
        (xs[Math.min(k, chips.length - 1)] ?? 0) +
        (chips[Math.min(k, chips.length - 1)]?.w ?? 0) / 2;
    const offset = total <= width ? 0 : clamp(focus - width * 0.5, 0, total - width);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - 2, width, h + 4);
    ctx.clip();
    for (const [i, c] of chips.entries()) {
        const x = (xs[i] ?? 0) - offset;
        const isDone = i < k || done;
        const isCurrent = i === k && !done;
        const failedShown = c.s.failed !== undefined && (i < k || (i === k && frac > 0.3) || done);
        const color = failedShown
            ? palette.danger
            : isCurrent
                ? palette.marker
                : isDone
                    ? palette.inkFaint
                    : palette.inkMuted;
        box(
            ctx,
            x,
            y,
            c.w,
            h,
            4,
            palette.paper,
            failedShown || isCurrent ? color : palette.rule,
            failedShown || isCurrent ? 1.5 : 1,
        );
        text(frame, c.t, x + c.w / 2, y + 15, {
            align: "center",
            mono: true,
            size: 11,
            weight: 600,
            color,
        });
    }
    ctx.restore();
}
