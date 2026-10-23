import type { Frame } from "./definition.ts";
import { lerp, clamp } from "./time.ts";

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** The whole canvas as a rect, optionally inset. */
export const canvasRect = (frame: Frame, pad = 0): Rect => ({
    x: pad,
    y: pad,
    w: frame.width - pad * 2,
    h: frame.height - pad * 2,
});

/** Shrinks a rect on all sides, or by `[vertical, horizontal]`. */
export function inset(r: Rect, by: number | [number, number]): Rect {
    const [v, h] = typeof by === "number" ? [by, by] : by;
    return { x: r.x + h, y: r.y + v, w: r.w - h * 2, h: r.h - v * 2 };
}

/** Splits a rect into `n` stacked rows with `gap` between them. */
export function rows(r: Rect, n: number, gap = 0): Rect[] {
    const h = (r.h - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ x: r.x, y: r.y + i * (h + gap), w: r.w, h }));
}

/** Splits a rect into `n` side-by-side columns with `gap` between them. */
export function cols(r: Rect, n: number, gap = 0): Rect[] {
    const w = (r.w - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ x: r.x + i * (w + gap), y: r.y, w, h: r.h }));
}

export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * The cell at column `col`, row `row` of a grid of `cols` × `rows` square-ish
 * cells laid into `r`, with `gap` between them. For boards, mazes, heatmaps
 * and memory pages.
 */
export function gridCell(
    r: Rect,
    cols: number,
    rows: number,
    col: number,
    row: number,
    gap = 0,
): Rect {
    const w = (r.w - gap * (cols - 1)) / cols;
    const h = (r.h - gap * (rows - 1)) / rows;
    return { x: r.x + col * (w + gap), y: r.y + row * (h + gap), w, h };
}

/**
 * The largest rect of aspect `cols:rows` that fits inside `r`, centred. Use it
 * so a grid keeps square cells at any canvas width.
 */
export function fitAspect(r: Rect, cols: number, rows: number): Rect {
    const size = Math.min(r.w / cols, r.h / rows);
    const w = size * cols;
    const h = size * rows;
    return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/**
 * A point on a circle. `turn` is 0–1 going clockwise from 12 o'clock, which is
 * how rings, clocks and hash rings are read.
 */
export const polar = (c: Point, radius: number, turn: number): Point => ({
    x: c.x + radius * Math.sin(turn * Math.PI * 2),
    y: c.y - radius * Math.cos(turn * Math.PI * 2),
});

export interface Point {
    x: number;
    y: number;
}

/** A point `t` (0–1) of the way along a straight segment. */
export const along = (a: Point, b: Point, t: number): Point => ({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
});

/** A point `t` (0–1) of the way along a polyline, measured by length. */
export function alongPath(points: Point[], t: number): Point {
    const first = points[0] ?? { x: 0, y: 0 };
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1] ?? first;
        const b = points[i] ?? a;
        total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    let remaining = clamp(t) * total;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1] ?? first;
        const b = points[i] ?? a;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (remaining <= len) {
            return along(a, b, len === 0 ? 0 : remaining / len);
        }
        remaining -= len;
    }
    return points[points.length - 1] ?? first;
}

/**
 * The control point that bends a straight line from `a` to `b` sideways by
 * `bend` pixels (positive bends to the left of the direction of travel). Two
 * arrows between the same pair, one each way, stay apart with opposite bends.
 */
export function bendPoint(a: Point, b: Point, bend: number): Point {
    const mid = along(a, b, 0.5);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: mid.x + ((a.y - b.y) / len) * bend, y: mid.y + ((b.x - a.x) / len) * bend };
}

/** A point `t` (0–1) along the quadratic curve from `a` through control `c` to `b`. */
export function alongCurve(a: Point, c: Point, b: Point, t: number): Point {
    const u = 1 - t;
    return {
        x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
}

/**
 * Where a line from the centre `c` of a `w` × `h` box towards `toward` leaves
 * the box, plus `gap` pixels. Start and end arrows here so they touch the box
 * edges instead of disappearing under them.
 */
export function edgePoint(c: Point, w: number, h: number, toward: Point, gap = 4): Point {
    const dx = toward.x - c.x;
    const dy = toward.y - c.y;
    const sx = Math.abs(dx) > 1e-6 ? (w / 2 + gap) / Math.abs(dx) : Infinity;
    const sy = Math.abs(dy) > 1e-6 ? (h / 2 + gap) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: c.x + dx * s, y: c.y + dy * s };
}

/** The shortest distance from `p` to the segment `a`–`b`. */
export function distanceToSegment(p: Point, [a, b]: [Point, Point]): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Where a label goes on a segment; see `labelSpot`. */
export interface LabelSpot {
    /** Centre of the label. */
    x: number;
    y: number;
    /** Rotation, already turned so the text reads left to right. */
    angle: number;
    /** How far along the segment (0–1) the label sits. */
    along: number;
}

/**
 * The best place for a label of width `w` and font size `size` on segment
 * `seg`: slanted along it, lifted above it by half the text height, at the
 * point whose label is farthest from every segment in `others`. Ends are kept
 * clear so a label never sits on whatever the segment connects. Draw it with
 * `slantedLabel`. This is how edges keep their labels off the lines that cross
 * them when several are drawn at once.
 */
export function labelSpot(
    seg: [Point, Point],
    w: number,
    size: number,
    others: [Point, Point][],
): LabelSpot {
    const [a, b] = seg;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    // The normal that points up the screen, so the label sits above its line.
    let nx = -uy;
    let ny = ux;
    if (ny > 0) {
        nx = -nx;
        ny = -ny;
    }
    const lift = size / 2 + 3;
    const margin = Math.min(0.45, (w / 2 + 14) / len);

    let best: LabelSpot | undefined;
    let bestScore = -Infinity;
    for (let k = 0; k <= 16; k++) {
        const along = margin + ((1 - 2 * margin) * k) / 16;
        const cx = a.x + (b.x - a.x) * along + nx * lift;
        const cy = a.y + (b.y - a.y) * along + ny * lift;
        // Clearance of the label's long axis from the other segments, sampled.
        let clear = Infinity;
        for (const f of [-0.5, -0.25, 0, 0.25, 0.5]) {
            const p = { x: cx + ux * w * f, y: cy + uy * w * f };
            for (const o of others) {
                clear = Math.min(clear, distanceToSegment(p, o));
            }
        }
        // Prefer the middle when clearances are close.
        const score = Math.min(clear, 40) - Math.abs(along - 0.5) * 6;
        if (score > bestScore) {
            bestScore = score;
            let angle = Math.atan2(uy, ux);
            if (ux < 0) {
                angle += Math.PI;
            }
            best = { x: cx, y: cy, angle, along };
        }
    }
    return best ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift, angle: 0, along: 0.5 };
}
