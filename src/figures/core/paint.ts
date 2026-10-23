import { type Point, bendPoint, alongCurve, type Rect } from "./geometry.ts";
import { clamp, lerp, ease } from "./time.ts";
import type { Palette } from "./definition.ts";

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
