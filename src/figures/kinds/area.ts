/** Linear interpolation on a numeric x-axis; stacked areas require nonnegative data. */
import { defineFigure, ease, fittedText, formatNumber, progress, scale } from "#src/figures/kit.ts";
import { decodeArea, type AreaModel } from "#src/figures/charts/model.ts";
import {
    chartHeight,
    chartRect,
    header,
    legend,
    legendHeight,
    shape,
    yAxis,
} from "#src/figures/charts/draw.ts";

const TIMES = { start: 0.15, reveal: 1.5, end: 2 };

export default defineFigure<AreaModel>({
    duration: TIMES.end,
    height: 390,
    heightFor: (width, p) => chartHeight(width, p, p.series.length),
    decode: decodeArea,
    table: (p) => ({
        columns: [p.xLabel || "x", ...p.series.map((s) => s.label)],
        rows: p.x.map((x, i) => [x, ...p.series.map((s) => s.values[i] ?? 0)]),
        unit: p.unit,
    }),
    draw(frame, p) {
        const { ctx, width, height, palette } = frame;
        const percent = p.mode === "percent";
        header(frame, { ...p, unit: percent ? "%" : p.unit }, p.yLabel);
        const r = chartRect(frame, p, p.series.length, p.domain);
        const y = yAxis(frame, r, p.domain);
        const min = p.x[0] ?? 0;
        const max = p.x.at(-1) ?? 1;
        const x = scale(min, max, r.x, r.x + r.w);
        const ticks = width < 480 ? 2 : 4;
        for (let i = 0; i <= ticks; i++) {
            const value = min + ((max - min) * i) / ticks;
            fittedText(
                frame,
                formatNumber(value),
                x(value),
                r.y + r.h + 18,
                r.w / (ticks + 1),
                palette.inkMuted,
                i === 0 ? "left" : i === ticks ? "right" : "center",
            );
        }
        const t = ease.out(progress(frame.time, TIMES.start, TIMES.reveal));
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x - 0.5, r.y - 1, r.w * t + 1, r.h + 2);
        ctx.clip();
        // Draw later series first for overlay mode so the highlighted first remains visible.
        const order = p.series.map((_, i) => i);
        if (p.mode === "overlay") {
            order.reverse();
        }
        for (const j of order) {
            const cells = p.segments[j];
            const series = p.series[j];
            if (!cells || !series) {
                continue;
            }
            const path = new Path2D();
            cells.forEach((cell, i) => {
                const px = x(p.x[i] ?? min);
                if (i === 0) {
                    path.moveTo(px, y(cell.to));
                } else {
                    path.lineTo(px, y(cell.to));
                }
            });
            for (let i = cells.length - 1; i >= 0; i--) {
                path.lineTo(x(p.x[i] ?? min), y(cells[i]?.from ?? 0));
            }
            path.closePath();
            shape(frame, path, r, j, series.tone, p.mode === "overlay");
        }
        ctx.restore();
        const keysHeight = p.showLegend ? legendHeight(width, p.series.length) : 0;
        fittedText(
            frame,
            p.xLabel,
            r.x + r.w / 2,
            height - keysHeight - 12,
            r.w,
            palette.inkMuted,
            "center",
        );
        if (p.showLegend) {
            legend(
                frame,
                p.series.map((s, i) => ({
                    ...s,
                    label: p.showValues
                        ? `${s.label} · ${formatNumber(p.segments[i]?.at(-1)?.value ?? 0)}${percent ? "%" : ""}`
                        : s.label,
                })),
                height - keysHeight + 4,
            );
        }
    },
});
