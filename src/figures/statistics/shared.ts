/** Shared decoding, responsive axes, and time-based drawing for statistics. */
import {
    arr,
    clamp,
    dot,
    fittedText,
    formatNumber as fmt,
    line,
    maybe,
    num,
    nums,
    obj,
    partialPath,
    progress,
    scale,
    str,
    text,
    withAlpha,
    type Frame,
    type Point,
    type Rect,
} from "../kit.ts";
import type { JsonObject, JsonValue } from "../../utils/json.ts";

export const TIMES = {
    start: 0.5,
    reveal: 3.7,
    curveStart: 0,
    curveReveal: 2.4,
    curveGap: 0.08,
    duration: 6,
} as const;
export type Domain = [number, number];

export function bounded(
    v: JsonValue | undefined,
    path: string,
    lo: number,
    hi: number,
    integer = false,
): number {
    const value = num(v, path);
    if (value < lo || value > hi || (integer && !Number.isInteger(value)))
        throw new Error(
            `${path} must be ${integer ? "an integer" : "a number"} from ${String(lo)} to ${String(hi)}`,
        );
    return value;
}

export function sample(v: JsonValue | undefined, path: string, min = 2, max = 2000): number[] {
    const values = nums(v, path);
    if (values.length < min || values.length > max || values.some((n) => Math.abs(n) > 1e12))
        throw new Error(
            `${path} needs ${String(min)}–${String(max)} finite values with magnitude at most 1e12`,
        );
    return values;
}

export function bool(v: JsonValue | undefined, path: string, fallback = false): boolean {
    if (v === undefined) return fallback;
    if (typeof v !== "boolean") throw new Error(`${path} must be true or false`);
    return v;
}

export interface Group {
    label: string;
    values: number[];
}
export function readGroups(p: JsonObject): Group[] {
    const groups = arr(p.groups, "props.groups").map((v, i) => {
        const path = `props.groups[${String(i)}]`;
        const g = obj(v, path);
        return {
            label: str(g.label, `${path}.label`),
            values: sample(g.values, `${path}.values`).sort((a, b) => a - b),
        };
    });
    if (groups.length < 1 || groups.length > 8) throw new Error("props.groups needs 1–8 groups");
    return groups;
}

export function readPoints(p: JsonObject, min = 2): Point[] {
    const points = arr(p.points, "props.points").map((v, i) => {
        const path = `props.points[${String(i)}]`;
        const point = obj(v, path);
        return {
            x: bounded(point.x, `${path}.x`, -1e12, 1e12),
            y: bounded(point.y, `${path}.y`, -1e12, 1e12),
        };
    });
    if (points.length < min || points.length > 2000)
        throw new Error(`props.points needs ${String(min)}–2000 points`);
    return points;
}

export function common(p: JsonObject, fallback: string) {
    return { title: maybe(p.title, "props.title", str) ?? fallback };
}

export function extent(values: readonly number[], padding = 0.08): Domain {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || Math.max(1, Math.abs(lo) * 0.2);
    return [
        lo - span * padding - (hi === lo ? span / 2 : 0),
        hi + span * padding + (hi === lo ? span / 2 : 0),
    ];
}

export { formatNumber as fmt } from "../kit.ts";

export { fittedText } from "../kit.ts";

export function header(frame: Frame, title: string, summary: string): void {
    fittedText(frame, title, 0, 14, frame.width, frame.palette.inkStrong);
    fittedText(frame, summary, 0, 33, frame.width, frame.palette.inkMuted);
}

export interface Plot {
    rect: Rect;
    x: (v: number) => number;
    y: (v: number) => number;
}

export function axes(
    frame: Frame,
    xd: Domain,
    yd: Domain,
    options: {
        rect?: Rect;
        xLabel?: string;
        yLabel?: string;
        reverseY?: boolean;
        xTicks?: boolean;
        yTicks?: boolean;
    } = {},
): Plot {
    const { width, height, ctx, palette } = frame;
    let ticks = width < 520 ? 3 : 4;
    ctx.font = `400 11px ${palette.mono}`;
    const tickValues = (domain: Domain) =>
        Array.from(
            { length: ticks + 1 },
            (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / ticks,
        );
    const labelWidth =
        options.yTicks === false
            ? 0
            : Math.max(...tickValues(yd).map((v) => ctx.measureText(fmt(v)).width));
    const left = Math.max(48, Math.ceil(labelWidth + 7));
    const rect = options.rect ?? { x: left, y: 60, w: width - left - 16, h: height - 104 };
    const widestX = Math.max(...tickValues(xd).map((v) => ctx.measureText(fmt(v)).width));
    ticks = Math.max(1, Math.min(ticks, Math.floor(rect.w / (widestX * 1.5 + 8))));
    const x = scale(xd[0], xd[1], rect.x, rect.x + rect.w);
    const y = scale(
        yd[0],
        yd[1],
        options.reverseY ? rect.y : rect.y + rect.h,
        options.reverseY ? rect.y + rect.h : rect.y,
    );
    for (let i = 0; i <= ticks; i++) {
        const xv = xd[0] + ((xd[1] - xd[0]) * i) / ticks;
        const yv = yd[0] + ((yd[1] - yd[0]) * i) / ticks;
        if (options.xTicks !== false) {
            line(ctx, x(xv), rect.y, x(xv), rect.y + rect.h, palette.ruleFaint);
            text(frame, fmt(xv), x(xv), rect.y + rect.h + 17, {
                size: 11,
                mono: true,
                align: i === 0 ? "left" : i === ticks ? "right" : "center",
                color: palette.inkFaint,
            });
        }
        if (options.yTicks !== false) {
            line(ctx, rect.x, y(yv), rect.x + rect.w, y(yv), palette.ruleFaint);
            text(frame, fmt(yv), rect.x - 6, y(yv) + 4, {
                size: 11,
                mono: true,
                align: "right",
                color: palette.inkFaint,
            });
        }
    }
    line(ctx, rect.x, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h, palette.rule);
    if (options.xLabel)
        fittedText(
            frame,
            options.xLabel,
            rect.x + rect.w / 2,
            rect.y + rect.h + 35,
            rect.w,
            palette.inkMuted,
            "center",
        );
    if (options.yLabel)
        fittedText(frame, options.yLabel, rect.x, rect.y - 10, rect.w, palette.inkMuted);
    return { rect, x, y };
}

export function clipped(frame: Frame, rect: Rect, paint: () => void): void {
    const { ctx } = frame;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    paint();
    ctx.restore();
}

export function curve(
    frame: Frame,
    plot: Plot,
    points: Point[],
    color = frame.palette.marker,
    at = progress(frame.time, TIMES.start, TIMES.reveal),
    width = 2,
    dash: number[] = [],
): void {
    clipped(frame, plot.rect, () => {
        frame.ctx.strokeStyle = color;
        frame.ctx.lineWidth = width;
        frame.ctx.setLineDash(dash);
        partialPath(
            frame.ctx,
            points.map((p) => ({ x: plot.x(p.x), y: plot.y(p.y) })),
            at,
        );
    });
}

export function legend(frame: Frame, labels: string[]): void {
    const w = frame.width / labels.length;
    labels.forEach((name, i) => {
        const color = i === 0 ? frame.palette.marker : frame.palette.inkMuted;
        line(frame.ctx, w * i, 29, w * i + 15, 29, color, 2, i === 0 ? [] : [i + 1, 3]);
        fittedText(frame, name, w * i + 20, 33, w - 24, color);
    });
}

export function points(
    frame: Frame,
    plot: Plot,
    data: readonly Point[],
    color = frame.palette.marker,
    radius = 3,
): void {
    clipped(frame, plot.rect, () => {
        for (const [i, p] of data.entries()) {
            const shown = progress(frame.time, TIMES.start + (i / data.length) * TIMES.reveal, 0.3);
            withAlpha(frame.ctx, shown * 0.8, () => {
                dot(frame.ctx, plot.x(p.x), plot.y(p.y), radius, color);
            });
        }
    });
}

export function reference(
    frame: Frame,
    plot: Plot,
    a: Point,
    b: Point,
    color = frame.palette.inkFaint,
): void {
    clipped(frame, plot.rect, () => {
        line(frame.ctx, plot.x(a.x), plot.y(a.y), plot.x(b.x), plot.y(b.y), color, 1, [4, 4]);
    });
}

/** Greedy screen-space packing. Every point keeps its exact value coordinate. */
export function swarmPositions(
    values: readonly number[],
    valueToY: (value: number) => number,
    radius: number,
    maxOffset: number,
): Point[] {
    const placed: Point[] = [];
    for (const value of values) {
        const y = valueToY(value);
        let x = 0;
        for (let step = 0; step < 300; step++) {
            const candidate = Math.ceil(step / 2) * radius * 1.8 * (step % 2 === 0 ? -1 : 1);
            if (Math.abs(candidate) > maxOffset) break;
            if (placed.every((p) => Math.hypot(p.x - candidate, p.y - y) >= radius * 2 + 0.2)) {
                x = candidate;
                break;
            }
        }
        placed.push({ x: clamp(x, -maxOffset, maxOffset), y });
    }
    return placed;
}
