/**
 * The toolkit every animated figure is written against.
 *
 * A figure is a pure function of time: `draw(frame, props)` paints the whole
 * canvas for `frame.time` seconds into the animation, and nothing else. It keeps
 * no state between frames, so the runtime can seek to any moment — which is how
 * reduced motion shows the final frame and how `npm run figures:shot` captures
 * stills to look at — and a figure never drifts out of step with itself.
 *
 * Randomness goes through `random(seed)`, never `Math.random`, for the same
 * reason: the same moment has to look the same every time it is drawn.
 *
 * See `README.md` next to this file for how to write one.
 */

import { isJsonObject, type JsonValue } from "../utils/json.ts";

/* — what a figure is ————————————————————————————— */

/** Colours and faces, read from the active theme's tokens on every redraw. */
export interface Palette {
    paper: string;
    surface: string;
    inkStrong: string;
    ink: string;
    inkMuted: string;
    inkFaint: string;
    rule: string;
    ruleFaint: string;
    /** The site's one accent. Use it for the thing the reader should watch. */
    marker: string;
    markerWash: string;
    warn: string;
    danger: string;
    sans: string;
    mono: string;
}

export interface Frame {
    ctx: CanvasRenderingContext2D;
    /** CSS pixels. The canvas is already scaled for the device. */
    width: number;
    height: number;
    /** Seconds since the figure started, from 0 to `duration`. */
    time: number;
    palette: Palette;
}

export interface FigureKind<P> {
    /** Seconds the animation runs before it holds on its last frame. */
    duration: number;
    /** Start over after a pause instead of holding. Use for steady-state motion. */
    loop?: boolean;
    /** Canvas height in CSS pixels unless the post overrides it. */
    height?: number;
    /**
     * Canvas height for a given width, when the right height depends on the
     * width — a grid with square cells, a ring that should stay round. Called
     * whenever the figure is resized. `height` is still used before the first
     * measurement and when the post sets a height itself.
     */
    heightFor?: (width: number, props: P) => number;
    /**
     * Turns the post's `props` into the figure's own type, or throws naming the
     * field that is wrong. Runs at build time, so a typo fails the build.
     */
    decode: (raw: JsonValue) => P;
    draw: (frame: Frame, props: P) => void;
}

/** A figure bound to one post's props: what the runtime holds per canvas. */
export interface BoundFigure {
    paint: (frame: Frame) => void;
    heightFor: ((width: number) => number) | undefined;
}

/**
 * A figure with its props type erased, which is what the runtime and the
 * `<Figure>` component hold: they never need to know what `P` was, only how to
 * check a post's props and get back something that draws.
 */
export interface DefinedFigure {
    duration: number;
    loop: boolean;
    height: number;
    /** Decodes `raw` (throwing if it is wrong) and returns the bound figure. */
    bind: (raw: JsonValue) => BoundFigure;
}

export function defineFigure<P>(kind: FigureKind<P>): DefinedFigure {
    return {
        duration: kind.duration,
        loop: kind.loop ?? false,
        height: kind.height ?? 280,
        bind(raw) {
            const props = kind.decode(raw);
            const { heightFor } = kind;
            return {
                paint: (frame) => {
                    kind.draw(frame, props);
                },
                heightFor: heightFor && ((width) => heightFor(width, props)),
            };
        },
    };
}

/* — time ———————————————————————————————————————— */

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 before `start`, 1 after `start + length`, linear in between. */
export const progress = (time: number, start: number, length: number): number =>
    length <= 0 ? (time >= start ? 1 : 0) : clamp((time - start) / length);

export const ease = {
    linear: (t: number) => t,
    out: (t: number) => 1 - (1 - t) ** 3,
    inOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    /** Overshoots a little and settles — for things that land. */
    back: (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
    /** Gentle at both ends; for slow, continuous motion. */
    sine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
    /** Fast in, then a soft stop. */
    expo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
};

/** True while `start <= time < end`. */
export const between = (time: number, start: number, end: number): boolean =>
    time >= start && time < end;

/**
 * Up and back down once over `length` seconds: 0 → 1 → 0. For a flash, a
 * highlight that comes and goes, or a node that pulses when something arrives.
 */
export const flash = (time: number, start: number, length: number): number =>
    Math.sin(Math.PI * progress(time, start, length));

/** A steady 0–1 oscillation, for things that should look alive while waiting. */
export const pulse = (time: number, period = 1.2): number =>
    (1 - Math.cos((2 * Math.PI * time) / period)) / 2;

/**
 * When item `i` of `n` starts, if the whole group starts at `start` and the
 * last one starts at `start + span`. For things that appear one after another.
 */
export const stagger = (i: number, n: number, start: number, span: number): number =>
    n <= 1 ? start : start + (span * i) / (n - 1);

/**
 * Turns a list of step lengths into start times, so a story is written as
 * durations and the arithmetic is done once:
 *
 *   const T = phases({ appear: 0.6, fill: 1.2, drain: 2, verdict: 0.5 });
 *   T.fill    // 0.6, when `fill` starts
 *   T.end     // 4.3, when the last step ends
 */
export function phases<K extends string>(steps: Record<K, number>): Record<K | "end", number> {
    let at = 0;
    const out: Record<K | "end", number> = { ...steps, end: 0 };
    for (const key in steps) {
        if (!Object.hasOwn(steps, key)) {
            continue;
        }
        out[key] = at;
        at += steps[key];
    }
    out.end = at;
    return out;
}

/** A number that counts from `from` to `to` while `t` goes 0 → 1. */
export const countUp = (from: number, to: number, t: number): number =>
    from + (to - from) * ease.out(clamp(t));

/* — data ———————————————————————————————————————— */

/** Deterministic random numbers in [0, 1). Same seed, same sequence. */
export function random(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let r = Math.imul(s ^ (s >>> 15), 1 | s);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** A standard normal sample (mean 0, sd 1) from a `random()` source. */
export function normal(rand: () => number): number {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Right-skewed positive values around `median`, the shape of latencies and
 * service times. `spread` is the log-space sigma: 0.2 is tight, 0.6 is wide.
 */
export const lognormal = (rand: () => number, median: number, spread: number): number =>
    median * Math.exp(spread * normal(rand));

/**
 * `count` arrival times with random gaps averaging `meanGap` seconds — how
 * independent events (requests, customers, cars) actually arrive.
 */
export function arrivals(count: number, meanGap: number, seed: number, start = 0): number[] {
    const rand = random(seed);
    const out: number[] = [];
    let at = start;
    for (let i = 0; i < count; i++) {
        out.push(at);
        at += -Math.log(Math.max(rand(), 1e-9)) * meanGap;
    }
    return out;
}

/** Picks one of `items` with a `random()` source. */
export const pick = <T>(rand: () => number, items: readonly T[]): T | undefined =>
    items[Math.floor(rand() * items.length)];

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : sum(values) / values.length;

/** The `p`th percentile (0–100) of already sorted values, nearest-rank. */
export function percentile(sorted: readonly number[], p: number): number {
    if (sorted.length === 0) {
        return 0;
    }
    const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, i)] ?? 0;
}

/**
 * A well-spread 32-bit hash of a string: FNV-1a, finished with murmur3's
 * mixer so similar strings ("key-1", "key-2") land far apart. Deterministic,
 * so it can place keys, servers or colours the same way on every build.
 */
export function hash32(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

/** 6.2 → "6.2", 7 → "7", 7.04 → "7": at most `digits` decimals, no trailing ".0". */
export function trimNumber(v: number, digits = 1): string {
    return Math.abs(v - Math.round(v)) < 1e-6
        ? String(Math.round(v))
        : v.toFixed(digits).replace(/\.?0+$/, "");
}

/**
 * A round tick spacing (1, 2 or 5 times a power of ten) that puts at most
 * `maxTicks` ticks across `span`. For time and value axes.
 */
export function tickStep(span: number, maxTicks: number): number {
    const raw = span / maxTicks;
    const base = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) {
        if (base * m >= raw) {
            return base * m;
        }
    }
    return base * 10;
}

/** Maps a domain onto a range, like d3's linear scale. */
export const scale =
    (d0: number, d1: number, r0: number, r1: number) =>
        (v: number): number =>
            d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** A round number at or above `v`, for axis maxima: 7.3k → 8k, 0.42 → 0.5. */
export function niceMax(v: number): number {
    if (v <= 0) {
        return 1;
    }
    const step = 10 ** Math.floor(Math.log10(v));
    const m = v / step;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return nice * step;
}

/** 1200 → "1.2k", 3_400_000 → "3.4M". */
export function compact(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1e6) {
        return `${trim(v / 1e6)}M`;
    }
    if (abs >= 1e3) {
        return `${trim(v / 1e3)}k`;
    }
    return trim(v);
}

const trim = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 1 : 0));

/* — layout ——————————————————————————————————————— */

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

/* — drawing ————————————————————————————————————— */

export interface TextStyle {
    size?: number;
    weight?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    mono?: boolean;
}

export function text(
    frame: Frame,
    value: string,
    x: number,
    y: number,
    style: TextStyle = {},
): void {
    const { ctx, palette } = frame;
    ctx.font = `${String(style.weight ?? 400)} ${String(style.size ?? 12)}px ${
        style.mono ? palette.mono : palette.sans
    }`;
    ctx.fillStyle = style.color ?? palette.inkMuted;
    ctx.textAlign = style.align ?? "left";
    ctx.textBaseline = style.baseline ?? "alphabetic";
    ctx.fillText(value, x, y);
}

/** Draw text within a width, preserving complete graphemes when truncating. */
/** Compact numeric labels, retaining small magnitudes in scientific notation. */
export const formatNumber = (n: number): string => {
    if (n === 0) {
        return "0";
    }
    if (Math.abs(n) >= 10000 || Math.abs(n) < 0.001)
    {
        return n.toExponential(1).replace(".0e", "e").replace("e+", "e");
    }
    return Number(n.toFixed(Math.abs(n) < 1 ? 3 : 2)).toString();
};

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function fittedText(
    frame: Frame,
    value: string,
    x: number,
    y: number,
    width: number,
    color = frame.palette.inkMuted,
    align: CanvasTextAlign = "left",
): void {
    frame.ctx.font = `400 11px ${frame.palette.sans}`;
    if (width < frame.ctx.measureText("…").width) {
        return;
    }
    let shown = value;
    if (frame.ctx.measureText(shown).width > width) {
        const characters = Array.from(graphemes.segment(value), (part) => part.segment);
        while (
            characters.length > 0 &&
            frame.ctx.measureText(`${characters.join("")}…`).width > width
        )
        {
            characters.pop();
        }
        shown = `${characters.join("")}…`;
    }
    text(frame, shown, x, y, { size: 11, color, align });
}

/**
 * Text on a paper-coloured plate, for labels that sit on top of lines. Flips to
 * the left of `x` if it would run past `maxX`. Returns the plate's width.
 */
export function label(
    frame: Frame,
    value: string,
    x: number,
    y: number,
    style: TextStyle & { maxX?: number } = {},
): number {
    const { ctx, palette } = frame;
    const size = style.size ?? 12;
    ctx.font = `${String(style.weight ?? 400)} ${String(size)}px ${
        style.mono ? palette.mono : palette.sans
    }`;
    const w = ctx.measureText(value).width + 8;
    const maxX = style.maxX ?? frame.width;
    const centred = style.align === "center";
    let left = centred ? x - w / 2 : x;
    if (!centred && left + w > maxX) {
        left = x - w - 8;
    }
    ctx.fillStyle = palette.paper;
    ctx.fillRect(left, y - size, w, size + 6);
    text(frame, value, left + 4, y, { ...style, align: "left" });
    return w;
}

export function line(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    width = 1,
    dash: number[] = [],
): void {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
}

export function dot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
): void {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

export function box(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | null,
    stroke: string | null = null,
    strokeWidth = 1,
): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
    }
}

export interface Point {
    x: number;
    y: number;
}

/**
 * Strokes the first `t` (0–1) of a polyline, measured along its length, and
 * returns where the pen stopped. This is the "line drawing itself" effect.
 */
export function partialPath(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    t: number,
): Point | undefined {
    const first = points[0];
    if (!first) {
        return undefined;
    }

    const lengths: number[] = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const len = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
        lengths.push(len);
        total += len;
    }

    let remaining = clamp(t) * total;
    let end: Point = first;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const len = lengths[i - 1] ?? 0;
        if (!a || !b) {
            break;
        }
        if (remaining >= len) {
            ctx.lineTo(b.x, b.y);
            end = b;
            remaining -= len;
            continue;
        }
        const f = len === 0 ? 0 : remaining / len;
        end = { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
        ctx.lineTo(end.x, end.y);
        break;
    }
    ctx.stroke();
    return end;
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

/** An unfilled circle: something waiting, or a slot that is empty. */
export function ring(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    width = 1.5,
): void {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * Something failing at a point: an × inside a ring that grows and fades.
 * `age` runs 0→1 over the burst; nothing is drawn outside that range.
 */
export function burst(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    age: number,
    color: string,
): void {
    if (age <= 0 || age >= 1) {
        return;
    }
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * (1 - ease.out(age) * 0.9);
    ring(ctx, x, y, 5 + ease.out(age) * 9, color, 2);
    const k = 4;
    line(ctx, x - k, y - k, x + k, y + k, color, 2);
    line(ctx, x - k, y + k, x + k, y - k, color, 2);
    ctx.globalAlpha = alpha;
}

/** A straight line ending in an arrowhead at `to`. */
export function arrow(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    color: string,
    width = 1.5,
    head = 7,
): void {
    line(ctx, from.x, from.y, to.x, to.y, color, width);
    arrowHead(ctx, to, Math.atan2(to.y - from.y, to.x - from.x), color, head);
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
 * A curved arrow from `a` to `b`, bent sideways by `bend` pixels, drawn up to
 * `t` (0–1) of its length so it can grow in. The head appears once complete.
 */
export function curvedArrow(
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point,
    bend: number,
    color: string,
    width = 1.5,
    t = 1,
    dash: number[] = [],
): void {
    const c = bendPoint(a, b, bend);
    const steps = 24;
    const end = clamp(t);
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i <= steps; i++) {
        const p = alongCurve(a, c, b, (end * i) / steps);
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (end < 1) {
        return;
    }
    const tail = alongCurve(a, c, b, 0.94);
    arrowHead(ctx, b, Math.atan2(b.y - tail.y, b.x - tail.x), color);
}

/** An arc of a circle from turn `from` to turn `to` (0–1, clockwise from 12). */
export function arc(
    ctx: CanvasRenderingContext2D,
    c: Point,
    radius: number,
    from: number,
    to: number,
    color: string,
    width = 1.5,
): void {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.arc(c.x, c.y, radius, (from - 0.25) * Math.PI * 2, (to - 0.25) * Math.PI * 2);
    ctx.stroke();
}

/** A filled arrowhead with its tip at `tip`, pointing along `angle` (radians). */
export function arrowHead(
    ctx: CanvasRenderingContext2D,
    tip: Point,
    angle: number,
    color: string,
    size = 7,
): void {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - size * Math.cos(angle - 0.45), tip.y - size * Math.sin(angle - 0.45));
    ctx.lineTo(tip.x - size * Math.cos(angle + 0.45), tip.y - size * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
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

/**
 * A rect tinted and struck with diagonal lines in `color`. Use it for time or
 * space that is taken but idle: waiting, reserved, blocked.
 */
export function hatch(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
    if (r.w <= 0.5) {
        return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha /= 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let d = -r.h; d < r.w + r.h; d += 5) {
        ctx.moveTo(r.x + d, r.y + r.h);
        ctx.lineTo(r.x + d + r.h, r.y);
    }
    ctx.stroke();
    ctx.restore();
}

/**
 * Fills a rect with a colour `t` (0–1) of the way along a sequential ramp from
 * `surface` to `marker`. The palette's colours are oklch strings that cannot
 * be mixed by arithmetic, so the ramp is made by painting the marker over the
 * surface at increasing opacity. `floor` keeps the lowest value visible.
 */
export function rampFill(
    ctx: CanvasRenderingContext2D,
    palette: Palette,
    r: Rect,
    t: number,
    floor = 0.12,
): void {
    ctx.fillStyle = palette.surface;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    withAlpha(ctx, floor + clamp(t) * (1 - floor), () => {
        ctx.fillStyle = palette.marker;
        ctx.fillRect(r.x, r.y, r.w, r.h);
    });
}

/**
 * A small tile with a number in it: a key, a slot, a request. Too small for
 * the number, it shows a dot instead.
 */
export function chip(frame: Frame, r: Rect, value: number | string, color: string): void {
    const { ctx, palette } = frame;
    box(ctx, r.x, r.y, r.w, r.h, 3, palette.paper, color, 1.2);
    if (r.h >= 14 && r.w >= 18) {
        text(frame, String(value), r.x + r.w / 2, r.y + r.h / 2 + 4, {
            align: "center",
            mono: true,
            size: 11,
            color,
        });
    } else {
        dot(ctx, r.x + r.w / 2, r.y + r.h / 2, clamp(Math.min(r.w, r.h) / 4, 1.5, 3), color);
    }
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

/**
 * Mono text rotated to `spot.angle`, on a faint plate that dims what crosses
 * it without hiding it.
 */
export function slantedLabel(
    frame: Frame,
    value: string,
    spot: LabelSpot,
    size: number,
    color: string,
): void {
    const { ctx, palette } = frame;
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.angle);
    ctx.font = `600 ${String(size)}px ${palette.mono}`;
    const w = ctx.measureText(value).width;
    withAlpha(ctx, 0.82, () => {
        ctx.fillStyle = palette.paper;
        ctx.fillRect(-w / 2 - 3, -size / 2 - 1, w + 6, size + 2);
    });
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, 0, 0.5);
    ctx.restore();
}

/** A horizontal progress bar: a track, filled `frac` (0–1) of the way. */
export function bar(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    frac: number,
    fill: string,
    track: string,
): void {
    ctx.fillStyle = track;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = fill;
    ctx.fillRect(r.x, r.y, r.w * clamp(frac), r.h);
}

/**
 * A row of `n` cells with the first `filled` lit — a gauge for counts such as
 * connections in use or seats taken. Cells past `limit` are lit in `over`,
 * and a dashed tick marks the limit, which is what makes "too many" readable.
 */
export function cells(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    n: number,
    filled: number,
    colors: { on: string; off: string; over?: string; tick?: string },
    limit?: number,
): void {
    const gap = 2;
    const w = (r.w - gap * (n - 1)) / n;
    for (let k = 0; k < n; k++) {
        ctx.fillStyle =
            k >= filled
                ? colors.off
                : limit !== undefined && k >= limit
                    ? (colors.over ?? colors.on)
                    : colors.on;
        ctx.fillRect(r.x + k * (w + gap), r.y, w, r.h);
    }
    if (limit !== undefined && limit > 0 && limit < n) {
        const x = r.x + limit * (w + gap) - gap / 2;
        line(ctx, x, r.y - 4, x, r.y + r.h + 4, colors.tick ?? colors.on, 1, [2, 2]);
    }
}

/** A small rounded tag: a word on a tinted plate with a border in `color`. */
export function badge(
    frame: Frame,
    value: string,
    x: number,
    y: number,
    color: string,
    align: "left" | "center" | "right" = "left",
): void {
    const { ctx, palette } = frame;
    ctx.font = `600 11px ${palette.mono}`;
    const w = ctx.measureText(value).width + 12;
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    box(ctx, left, y - 12, w, 17, 8, palette.paper, color, 1);
    text(frame, value, left + 6, y, { mono: true, size: 11, weight: 600, color });
}

/**
 * Runs `paint` with the canvas at `alpha` times the current opacity and puts
 * it back afterwards. Use it to fade a group in or out without remembering to
 * reset `globalAlpha`.
 */
export function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, paint: () => void): void {
    if (alpha <= 0) {
        return;
    }
    const before = ctx.globalAlpha;
    ctx.globalAlpha = before * clamp(alpha);
    paint();
    ctx.globalAlpha = before;
}

/**
 * Colour for "how bad is this value": ink below `warnAt`, `warn` from there,
 * `danger` from `dangerAt`. For things that get worse while you watch, such as
 * time spent waiting.
 */
export function heat(palette: Palette, value: number, warnAt: number, dangerAt: number): string {
    return value >= dangerAt ? palette.danger : value >= warnAt ? palette.warn : palette.inkMuted;
}

/** Colour names a post may use, mapped to the palette. */
export type Tone = "marker" | "ink" | "muted" | "warn" | "danger";
export const TONES: readonly Tone[] = ["marker", "ink", "muted", "warn", "danger"];

export function toneColor(palette: Palette, tone: Tone): string {
    switch (tone) {
        case "marker":
            return palette.marker;
        case "ink":
            return palette.inkStrong;
        case "muted":
            return palette.inkFaint;
        case "warn":
            return palette.warn;
        case "danger":
            return palette.danger;
    }
}

/* — decoding props ——————————————————————————————— */

/*
 * Small, strict readers for a figure's `decode`. Each takes the value and the
 * path it came from, so a bad prop fails the build with
 * `figure "line": props.series[1].values must be an array of numbers`
 * rather than drawing nothing in the browser.
 */

export class PropError extends Error {}

const fail = (path: string, expected: string): never => {
    throw new PropError(`${path} must be ${expected}`);
};

export function obj(v: JsonValue | undefined, path: string) {
    return isJsonObject(v) ? v : fail(path, "an object");
}

export function arr(v: JsonValue | undefined, path: string): JsonValue[] {
    return Array.isArray(v) ? v : fail(path, "an array");
}

export function num(v: JsonValue | undefined, path: string): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fail(path, "a number");
}

export function str(v: JsonValue | undefined, path: string): string {
    return typeof v === "string" ? v : fail(path, "a string");
}

export function nums(v: JsonValue | undefined, path: string): number[] {
    return arr(v, path).map((x, i) => num(x, `${path}[${String(i)}]`));
}

export function tone(v: JsonValue | undefined, path: string, fallback: Tone): Tone {
    if (v === undefined) {
        return fallback;
    }
    const found = TONES.find((t) => t === v);
    return found ?? fail(path, `one of ${TONES.join(", ")}`);
}

/** Reads an optional field: `undefined` when absent, decoded when present. */
export function maybe<T>(
    v: JsonValue | undefined,
    path: string,
    read: (v: JsonValue, path: string) => T,
): T | undefined {
    return v === undefined ? undefined : read(v, path);
}
