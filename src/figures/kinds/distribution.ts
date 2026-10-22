/**
 * distribution — samples drop one by one and pile up into a histogram.
 *
 * For "averages hide the tail": response times, queue waits, batch sizes. Each
 * group is its own panel on a shared axis, so two servers with the same mean
 * and different tails can be put side by side. Percentile markers are drawn
 * once every sample has landed. The slowest 5% are drawn in the marker colour
 * and everything else in ink, because the tail is what the reader should see.
 *
 *   <Figure kind="distribution" props={{
 *     unit: "ms",
 *     max: 1000,
 *     groups: [
 *       { label: "Server A", generate: { count: 60, median: 120, spread: 0.3 } },
 *       { label: "Server B", generate: { count: 60, median: 90, spread: 0.3 },
 *         outliers: [420, 460, 510, 880] },
 *     ],
 *     markers: ["p50", "p99"],
 *   }} />
 */

import {
    arr,
    defineFigure,
    dot,
    ease,
    formatNumber,
    fittedText,
    label,
    line,
    maybe,
    num,
    nums,
    obj,
    percentile,
    progress,
    scale,
    str,
    text,
} from "../kit.ts";
import type { JsonValue } from "../../utils/json.ts";
import { lognormalSamples } from "../generators.ts";

interface Group {
    label: string;
    samples: number[];
}

interface Props {
    unit: string;
    min: number;
    max: number;
    bins: number;
    groups: Group[];
    /** Percentiles to mark, 0–100. */
    markers: number[];
}

const DROP = 0.55;
const SPAN = 3.6;

function readMarker(v: JsonValue, path: string): number {
    if (typeof v === "number") {
        if (!Number.isFinite(v) || v < 0 || v > 100)
            throw new Error(`${path} must be a percentile from 0 to 100`);
        return v;
    }
    const s = str(v, path);
    const m = /^p(\d+(?:\.\d+)?)$/.exec(s);
    if (!m?.[1]) throw new Error(`${path} must be a number or like "p99"`);
    const value = Number(m[1]);
    if (value < 0 || value > 100) throw new Error(`${path} must be a percentile from 0 to 100`);
    return value;
}

export default defineFigure<Props>({
    duration: DROP + SPAN + 1.2,
    height: 240,

    decode(raw) {
        const p = obj(raw, "props");
        const groups = arr(p.groups, "props.groups").map((g, i) => {
            const path = `props.groups[${String(i)}]`;
            const o = obj(g, path);
            let samples: number[] = [];
            if (o.samples !== undefined) samples = nums(o.samples, `${path}.samples`);
            if (o.generate !== undefined) {
                const gen = obj(o.generate, `${path}.generate`);
                samples = samples.concat(
                    lognormalSamples(
                        num(gen.count, `${path}.generate.count`),
                        num(gen.median, `${path}.generate.median`),
                        maybe(gen.spread, `${path}.generate.spread`, num) ?? 0.35,
                        maybe(gen.seed, `${path}.generate.seed`, num) ?? i + 1,
                    ),
                );
            }
            if (o.outliers !== undefined) {
                samples = samples.concat(nums(o.outliers, `${path}.outliers`));
            }
            if (
                samples.length === 0 ||
                samples.length > 2000 ||
                samples.some((v) => Math.abs(v) > 1e12)
            ) {
                throw new Error(`${path} needs 1–2000 finite samples with magnitude at most 1e12`);
            }
            return { label: str(o.label ?? "", `${path}.label`), samples };
        });
        if (groups.length === 0 || groups.length > 4)
            throw new Error("props.groups needs 1–4 groups");

        const samples = groups.flatMap((group) => group.samples);
        const low = Math.min(...samples),
            high = Math.max(...samples);
        const min = maybe(p.min, "props.min", num) ?? Math.min(0, low);
        const max = maybe(p.max, "props.max", num) ?? (high > 0 ? high : low < 0 ? 0 : 1);
        const bins = maybe(p.bins, "props.bins", num) ?? 48;
        if (max <= min) throw new Error("props.max must exceed props.min");
        if (!Number.isInteger(bins) || bins < 2 || bins > 200)
            throw new Error("props.bins must be an integer from 2 to 200");

        return {
            unit: maybe(p.unit, "props.unit", str) ?? "",
            min,
            max,
            bins,
            groups,
            markers: arr(p.markers ?? [], "props.markers").map((m, i) =>
                readMarker(m, `props.markers[${String(i)}]`),
            ),
        };
    },

    draw(frame, props) {
        const { ctx, width, height, time, palette } = frame;
        const gap = 28;
        const panelW = (width - gap * (props.groups.length - 1)) / props.groups.length;
        const top = 30;
        const bottom = height - 26;
        const total = Math.max(...props.groups.map((g) => g.samples.length));

        props.groups.forEach((group, gi) => {
            const left = gi * (panelW + gap);
            const right = left + panelW;
            const x = scale(props.min, props.max, left + 4, right - 4);
            const binW = (right - left - 8) / props.bins;
            const r = Math.max(1.5, Math.min(4, binW / 2 - 0.6));
            const step = r * 2 + 1;

            fittedText(frame, group.label, left, 14, panelW, palette.inkStrong);
            line(ctx, left, bottom, right, bottom, palette.rule);
            // A narrow panel has room for the ends of the axis only.
            const ticks =
                panelW < 260
                    ? [props.min, props.max]
                    : [props.min, (props.min + props.max) / 2, props.max];
            for (const v of ticks) {
                text(frame, `${formatNumber(v)}${props.unit}`, x(v), bottom + 17, {
                    align: v === props.min ? "left" : v === props.max ? "right" : "center",
                    mono: true,
                    size: 11,
                    color: palette.inkFaint,
                });
            }

            const sorted = [...group.samples].sort((a, b) => a - b);
            const tail = percentile(sorted, 95);

            // Each sample lands on top of the ones already in its bin.
            const heights = new Map<number, number>();
            group.samples.forEach((value, i) => {
                const start = DROP + (i / total) * SPAN;
                const t = progress(time, start, 0.45);
                if (t <= 0) return;

                const bin = Math.min(
                    props.bins - 1,
                    Math.max(
                        0,
                        Math.floor(((value - props.min) / (props.max - props.min)) * props.bins),
                    ),
                );
                const level = heights.get(bin) ?? 0;
                heights.set(bin, level + 1);

                const cx = left + 4 + (bin + 0.5) * binW;
                const restY = Math.max(top, bottom - r - 1 - level * step);
                const cy = top - 10 + (restY - top + 10) * ease.out(t);
                const color = value > tail ? palette.marker : palette.inkMuted;
                ctx.globalAlpha = t < 1 ? 0.55 + 0.45 * t : 1;
                dot(ctx, cx, cy, r, color);
                ctx.globalAlpha = 1;
            });

            // Percentiles once the pile has settled.
            const shown = progress(time, DROP + SPAN + 0.3, 0.5);
            if (shown > 0 && props.markers.length > 0) {
                ctx.globalAlpha = shown;
                const placed = props.markers.map((p) => {
                    const v = percentile(sorted, p);
                    const mx = x(Math.max(props.min, Math.min(v, props.max)));
                    line(ctx, mx, top + 4, mx, bottom, palette.inkStrong, 1, [3, 3]);
                    return { p, v, mx };
                });
                // Labels after every line, so no line runs through a label.
                placed.forEach(({ p, v, mx }, mi) => {
                    label(
                        frame,
                        `p${String(p)} ${formatNumber(v)}${props.unit}`,
                        mx + 2,
                        top + 12 + mi * 18,
                        {
                            mono: true,
                            size: 11,
                            weight: 600,
                            color: palette.inkStrong,
                            maxX: right,
                        },
                    );
                });
                ctx.globalAlpha = 1;
            }
        });
    },
});
