/** Supplied intervals retain their statistical meaning; no inferred CI from bars. */
import { arr, defineFigure, dot, line, maybe, obj, progress, str, withAlpha } from "../kit.ts";
import {
    axes,
    bounded,
    clipped,
    common,
    extent,
    fittedText,
    fmt,
    header,
    points,
    reference,
    TIMES,
    type Domain,
} from "./shared.ts";
import type { JsonValue } from "../../utils/json.ts";

function estimate(raw: JsonValue | undefined, path: string, pooled = false) {
    const p = obj(raw, path);
    const value = bounded(p.estimate, `${path}.estimate`, -1e12, 1e12);
    const low = bounded(p.low, `${path}.low`, -1e12, 1e12);
    const high = bounded(p.high, `${path}.high`, -1e12, 1e12);
    if (low > value || value > high) throw new Error(`${path} needs low <= estimate <= high`);
    return {
        label: str(p.label, `${path}.label`),
        value,
        low,
        high,
        weight:
            p.weight === undefined
                ? 1
                : bounded(p.weight, `${path}.weight`, Number.MIN_VALUE, 1e12),
        pooled,
    };
}

interface IntervalProps {
    title: string;
    estimates: ReturnType<typeof estimate>[];
    baseline: number;
    xd: Domain;
    xLabel: string;
}

function intervals(forest: boolean) {
    return defineFigure<IntervalProps>({
        duration: TIMES.duration,
        height: 300,
        heightFor: (_width, p) => 100 + p.estimates.length * 32,
        decode(raw) {
            const p = obj(raw, "props");
            const estimates = arr(p.estimates, "props.estimates").map((v, i) =>
                estimate(v, `props.estimates[${String(i)}]`),
            );
            if (estimates.length < 1 || estimates.length > 20)
                throw new Error("props.estimates needs 1–20 intervals");
            if (p.pooled !== undefined) {
                if (!forest) throw new Error("props.pooled only applies to forest");
                estimates.push(estimate(p.pooled, "props.pooled", true));
            }
            const baseline =
                p.reference === undefined
                    ? 0
                    : bounded(p.reference, "props.reference", -1e12, 1e12);
            return {
                ...common(p, forest ? "Forest plot" : "Estimates and intervals"),
                estimates,
                baseline,
                xd: extent([...estimates.flatMap((e) => [e.low, e.high]), baseline]),
                xLabel: maybe(p.xLabel, "props.xLabel", str) ?? "estimate and supplied interval",
            };
        },
        draw(frame, p) {
            header(
                frame,
                p.title,
                forest
                    ? "square area ∝ supplied weight · diamond = supplied pooled interval"
                    : "points = estimates · bars = supplied intervals",
            );
            const labelW = frame.width < 520 ? 84 : 120;
            const plot = axes(frame, p.xd, [0, p.estimates.length], {
                rect: { x: labelW, y: 58, w: frame.width - labelW - 16, h: frame.height - 102 },
                yTicks: false,
                xLabel: p.xLabel,
            });
            reference(
                frame,
                plot,
                { x: p.baseline, y: 0 },
                { x: p.baseline, y: p.estimates.length },
            );
            const maxWeight = Math.max(...p.estimates.map((e) => e.weight));
            p.estimates.forEach((e, i) => {
                const y = plot.y(p.estimates.length - i - 0.5);
                fittedText(frame, e.label, 0, y + 4, labelW - 8, frame.palette.inkStrong);
                withAlpha(
                    frame.ctx,
                    progress(
                        frame.time,
                        TIMES.start + (i / p.estimates.length) * TIMES.reveal,
                        0.5,
                    ),
                    () => {
                        clipped(frame, plot.rect, () => {
                            const color =
                                e.pooled || i === 0 ? frame.palette.marker : frame.palette.inkMuted;
                            if (e.pooled) {
                                frame.ctx.beginPath();
                                frame.ctx.moveTo(plot.x(e.low), y);
                                frame.ctx.lineTo(plot.x(e.value), y - 8);
                                frame.ctx.lineTo(plot.x(e.high), y);
                                frame.ctx.lineTo(plot.x(e.value), y + 8);
                                frame.ctx.closePath();
                                frame.ctx.fillStyle = color;
                                frame.ctx.fill();
                            } else {
                                line(frame.ctx, plot.x(e.low), y, plot.x(e.high), y, color, 1.7);
                                for (const value of [e.low, e.high])
                                    line(
                                        frame.ctx,
                                        plot.x(value),
                                        y - 4,
                                        plot.x(value),
                                        y + 4,
                                        color,
                                        1.3,
                                    );
                                if (forest) {
                                    const side = 5 + 9 * Math.sqrt(e.weight / maxWeight);
                                    frame.ctx.fillStyle = color;
                                    frame.ctx.fillRect(
                                        plot.x(e.value) - side / 2,
                                        y - side / 2,
                                        side,
                                        side,
                                    );
                                } else dot(frame.ctx, plot.x(e.value), y, 4, color);
                            }
                        });
                    },
                );
            });
        },
    });
}

export const interval = intervals(false);
export const forest = intervals(true);

export const funnel = defineFigure({
    duration: TIMES.duration,
    height: 340,
    decode(raw) {
        const p = obj(raw, "props");
        const studies = arr(p.studies, "props.studies").map((s, i) => {
            const path = `props.studies[${String(i)}]`;
            const point = obj(s, path);
            return {
                x: bounded(point.estimate, `${path}.estimate`, -1e12, 1e12),
                y: bounded(point.se, `${path}.se`, 1e-12, 1e12),
            };
        });
        if (studies.length < 3 || studies.length > 1000)
            throw new Error("props.studies needs 3–1000 studies");
        // Normalize weights to avoid overflow without changing the weighted mean.
        const minSe = Math.min(...studies.map((s) => s.y));
        const weights = studies.map((s) => (minSe / s.y) ** 2);
        const total = weights.reduce((a, b) => a + b, 0);
        const center =
            p.center === undefined
                ? studies.reduce((a, s, i) => a + s.x * (weights[i] ?? 0), 0) / total
                : bounded(p.center, "props.center", -1e12, 1e12);
        const end = Math.max(...studies.map((s) => s.y)) * 1.1;
        return {
            ...common(p, "Funnel plot"),
            studies,
            center,
            end,
            xd: extent([...studies.map((s) => s.x), center - 1.96 * end, center + 1.96 * end]),
        };
    },
    draw(frame, p) {
        header(frame, p.title, `center=${fmt(p.center)} · guides: center ± 1.96 × SE`);
        const plot = axes(frame, p.xd, [0, p.end], {
            xLabel: "effect estimate",
            yLabel: "standard error (smaller at top)",
            reverseY: true,
        });
        for (const sign of [-1, 1])
            reference(
                frame,
                plot,
                { x: p.center, y: 0 },
                { x: p.center + sign * 1.96 * p.end, y: p.end },
            );
        reference(
            frame,
            plot,
            { x: p.center, y: 0 },
            { x: p.center, y: p.end },
            frame.palette.inkStrong,
        );
        points(frame, plot, p.studies);
    },
});
