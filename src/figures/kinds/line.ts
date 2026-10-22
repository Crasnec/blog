/**
 * line — a time series that draws itself left to right.
 *
 * For "this is what the metric did": traffic over a day, latency during an
 * incident, memory climbing. The pen carries the current value, and notes
 * appear as it passes them, so the reader is told what to look at the moment
 * it happens.
 *
 *   <Figure kind="line" props={{
 *     unit: "RPS",
 *     xLabels: ["00:00", "12:00", "24:00"],
 *     series: [{ label: "API", values: [120, 90, 400, 820, 610] }],
 *     notes: [{ at: 3, text: "Deploy" }],
 *   }} />
 */

import {
    arr,
    formatNumber,
    fittedText,
    defineFigure,
    dot,
    ease,
    lerp,
    line,
    maybe,
    niceMax,
    num,
    nums,
    obj,
    partialPath,
    progress,
    scale,
    str,
    text,
    tone,
    toneColor,
    type Point,
    type Tone,
} from "../kit.ts";

interface Series {
    label: string;
    values: number[];
    tone: Tone;
}

interface Note {
    at: number;
    text: string;
}

interface Props {
    unit: string | undefined;
    showValues: boolean;
    xLabels: string[];
    yMin: number;
    yMax: number;
    series: Series[];
    notes: Note[];
}

const PAD = { top: 28, right: 56, bottom: 26, left: 40 };
const DRAW = 4.2;

export default defineFigure<Props>({
    duration: 5,
    height: 260,
    heightFor: (width, props) =>
        260 +
        (props.series.length > 1 ? Math.ceil(props.series.length / (width < 520 ? 2 : 3)) * 18 : 0),

    decode(raw) {
        const p = obj(raw, "props");
        if (p.showValues !== undefined && typeof p.showValues !== "boolean")
            throw new Error("props.showValues must be true or false");
        const series = arr(p.series, "props.series").map((s, i) => {
            const o = obj(s, `props.series[${String(i)}]`);
            const values = nums(o.values, `props.series[${String(i)}].values`);
            if (
                values.length < 2 ||
                values.length > 2000 ||
                values.some((v) => Math.abs(v) > 1e12)
            ) {
                throw new Error(
                    `props.series[${String(i)}].values needs 2–2000 finite numbers with magnitude at most 1e12`,
                );
            }
            return {
                label: str(o.label ?? "", `props.series[${String(i)}].label`),
                values,
                tone: tone(o.tone, `props.series[${String(i)}].tone`, i === 0 ? "marker" : "muted"),
            };
        });
        if (series.length === 0 || series.length > 8)
            throw new Error("props.series needs 1–8 series");

        const all = series.flatMap((series) => series.values);
        const lowest = Math.min(...all),
            highest = Math.max(...all);
        const yMin = maybe(p.yMin, "props.yMin", num) ?? (lowest < 0 ? -niceMax(-lowest) : 0);
        const yMax =
            maybe(p.yMax, "props.yMax", num) ??
            (highest > 0 ? niceMax(highest) : lowest < 0 ? 0 : 1);
        if (yMax <= yMin || yMin > lowest || yMax < highest)
            throw new Error("props.yMin and props.yMax must be ordered and enclose all values");

        return {
            unit: maybe(p.unit, "props.unit", str),
            showValues: p.showValues ?? true,
            xLabels: arr(p.xLabels ?? [], "props.xLabels").map((l, i) =>
                str(l, `props.xLabels[${String(i)}]`),
            ),
            yMin,
            yMax,
            series,
            notes: arr(p.notes ?? [], "props.notes").map((n, i) => {
                const o = obj(n, `props.notes[${String(i)}]`);
                return {
                    at: num(o.at, `props.notes[${String(i)}].at`),
                    text: str(o.text, `props.notes[${String(i)}].text`),
                };
            }),
        };
    },

    draw(frame, props) {
        const { ctx, width, height, time, palette } = frame;
        const { yMin, yMax } = props;
        ctx.font = `400 11px ${palette.mono}`;
        const left = Math.max(
            PAD.left,
            ...[yMin, (yMin + yMax) / 2, yMax].map(
                (v) => ctx.measureText(formatNumber(v)).width + 8,
            ),
        );
        const right = width - PAD.right;
        const legendCols = width < 520 ? 2 : 3;
        const top =
            PAD.top +
            (props.series.length > 1 ? Math.ceil(props.series.length / legendCols) * 18 : 0);
        const bottom = height - PAD.bottom;

        const longest = Math.max(...props.series.map((s) => s.values.length));
        const x = scale(0, longest - 1, left, right);
        const y = scale(yMin, yMax, bottom, top);

        // Axes and grid appear at once; the data is what moves.
        for (let i = 0; i <= 2; i++) {
            const v = yMin + ((yMax - yMin) * i) / 2;
            const gy = y(v);
            line(ctx, left, gy, right, gy, i === 0 ? palette.rule : palette.ruleFaint);
            text(frame, formatNumber(v), left - 8, gy + 4, {
                align: "right",
                mono: true,
                size: 11,
                color: palette.inkFaint,
            });
        }
        if (props.unit) {
            fittedText(frame, props.unit, left, 14, right - left);
        }
        props.xLabels.forEach((label, i) => {
            const lx =
                props.xLabels.length === 1
                    ? left
                    : lerp(left, right, i / (props.xLabels.length - 1));
            text(frame, label, lx, bottom + 18, {
                align: i === 0 ? "left" : i === props.xLabels.length - 1 ? "right" : "center",
                mono: true,
                size: 11,
                color: palette.inkFaint,
            });
        });

        const t = ease.inOut(progress(time, 0.2, DRAW));
        const penX = left + (right - left) * t;

        // Notes sit behind the lines and show up once the pen reaches them. One
        // that would run into the previous note drops a row instead.
        let rowEnd = -Infinity;
        let row = 0;
        for (const note of [...props.notes].sort((a, b) => a.at - b.at)) {
            const nx = x(note.at);
            ctx.font = `600 12px ${palette.sans}`;
            const w = ctx.measureText(note.text).width + 10;
            row = nx < rowEnd ? row + 1 : 0;
            rowEnd = Math.max(nx + w, row === 0 ? -Infinity : rowEnd);
            const shown = progress(penX, nx - 1, 24);
            if (shown <= 0) continue;
            ctx.globalAlpha = shown;
            line(ctx, nx, top, nx, bottom, palette.inkFaint, 1, [3, 3]);
            text(frame, note.text, nx + 5, top + 10 + row * 16, {
                size: 12,
                weight: 600,
                color: palette.inkStrong,
            });
            ctx.globalAlpha = 1;
        }

        // Background series first, so the marker line is always on top.
        const ordered = [...props.series].sort(
            (a, b) => Number(a.tone === "marker") - Number(b.tone === "marker"),
        );
        for (const s of ordered) {
            const color = toneColor(palette, s.tone);
            const points: Point[] = s.values.map((v, i) => ({ x: x(i), y: y(v) }));

            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.strokeStyle = color;
            ctx.lineWidth = s.tone === "marker" ? 2.25 : 1.5;
            // Every series is cut at the same x, so their pens move together in
            // time even when one of them climbs a long way.
            const pen = partialPath(ctx, upTo(points, Math.min(penX, x(s.values.length - 1))), 1);
            if (!pen) continue;

            dot(ctx, pen.x, pen.y, 3.5, color);
            if (props.showValues) {
                const value = valueAt(s.values, ((pen.x - left) / (right - left)) * (longest - 1));
                fittedText(
                    frame,
                    formatNumber(value),
                    pen.x + 7,
                    pen.y + 4,
                    width - pen.x - 7,
                    color,
                );
            }
        }

        // Each label owns a cell, so arbitrary series names cannot collide.
        if (props.series.length > 1) {
            const cellW = (right - left) / legendCols;
            props.series.forEach((series, i) => {
                const lx = left + (i % legendCols) * cellW;
                const ly = 32 + Math.floor(i / legendCols) * 18;
                dot(ctx, lx + 4, ly - 4, 3.5, toneColor(palette, series.tone));
                fittedText(frame, series.label, lx + 14, ly, cellW - 18);
            });
        }
    },
});

/** The polyline up to `limit` on the x axis, ending exactly there. */
function upTo(points: Point[], limit: number): Point[] {
    const out: Point[] = [];
    for (const [i, p] of points.entries()) {
        if (p.x <= limit) {
            out.push(p);
            continue;
        }
        const prev = points[i - 1];
        if (prev) {
            const f = (limit - prev.x) / (p.x - prev.x);
            out.push({ x: limit, y: prev.y + (p.y - prev.y) * f });
        }
        break;
    }
    return out;
}

function valueAt(values: number[], index: number): number {
    const i = Math.max(0, Math.min(values.length - 1, index));
    const lo = Math.floor(i);
    const a = values[lo] ?? 0;
    const b = values[Math.min(values.length - 1, lo + 1)] ?? a;
    return a + (b - a) * (i - lo);
}
