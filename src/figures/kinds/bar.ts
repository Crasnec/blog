/** Category comparisons: vertical/horizontal, grouped/stacked/percent. */
import {
    defineFigure,
    ease,
    fittedText,
    formatNumber,
    line,
    progress,
    scale,
    type Frame,
    type Rect,
} from "../kit.ts";
import { decodeBar, type BarModel } from "../charts/model.ts";
import {
    chartHeight,
    chartRect,
    header,
    legend,
    legendHeight,
    shape,
    valueText,
    yAxis,
} from "../charts/draw.ts";

const TIMES = { start: 0.15, grow: 1.3, end: 1.8 };

function plotHeight(p: BarModel): number {
    const bars = p.mode === "grouped" ? p.series.length : 1;
    return p.orientation === "horizontal"
        ? Math.max(160, p.categories.length * (bars * 23 + 14))
        : 230;
}

function draw(frame: Frame, p: BarModel): void {
    const { ctx, palette, width, height } = frame;
    const horizontal = p.orientation === "horizontal";
    const percent = p.mode === "percent";
    header(frame, { ...p, unit: percent ? "%" : p.unit }, p.valueLabel);
    const r = chartRect(frame, p, p.series.length, p.domain);
    if (horizontal) {
        r.x = Math.min(150, width * 0.3);
        r.w = Math.max(1, width - r.x - 36);
    }
    const position = horizontal
        ? scale(p.domain.min, p.domain.max, r.x, r.x + r.w)
        : yAxis(frame, r, p.domain);
    if (horizontal) {
        // Fewer ticks on narrow horizontal axes keep large numbers readable.
        const stride = width < 480 ? 2 : 1;
        p.domain.ticks.forEach((tick, i) => {
            const x = position(tick);
            line(ctx, x, r.y, x, r.y + r.h, tick === 0 ? palette.inkMuted : palette.ruleFaint);
            if (i % stride === 0 || i === p.domain.ticks.length - 1) {
                fittedText(
                    frame,
                    formatNumber(tick),
                    x,
                    r.y + r.h + 18,
                    Math.min(60, r.w / 3),
                    palette.inkMuted,
                    "center",
                );
            }
        });
    }
    const slot = (horizontal ? r.h : r.w) / p.categories.length;
    const group = p.mode === "grouped" ? p.series.length : 1;
    const thickness = (slot * 0.7) / group;
    const t = ease.out(progress(frame.time, TIMES.start, TIMES.grow));
    p.categories.forEach((category, i) => {
        const center = (horizontal ? r.y : r.x) + (i + 0.5) * slot;
        if (horizontal) {
            fittedText(frame, category, r.x - 10, center + 4, r.x - 14, palette.ink, "right");
        } else if (i % Math.max(1, Math.ceil(32 / slot)) === 0) {
            fittedText(frame, category, center, r.y + r.h + 18, slot - 4, palette.ink, "center");
        }
        p.series.forEach((series, j) => {
            const segment = p.segments[j]?.[i];
            if (!segment) {
                return;
            }
            const a = position(segment.from * t);
            const b = position(segment.to * t);
            const side = center - slot * 0.35 + (group > 1 ? j * thickness : 0);
            const rect: Rect = horizontal
                ? { x: Math.min(a, b), y: side, w: Math.abs(b - a), h: thickness - 2 }
                : { x: side, y: Math.min(a, b), w: Math.max(1, thickness - 2), h: Math.abs(b - a) };
            if (segment.value !== 0 && t > 0) {
                const path = new Path2D();
                path.rect(rect.x, rect.y, rect.w, rect.h);
                shape(frame, path, rect, j, series.tone);
            }
            if (!p.showValues || t < 1) {
                return;
            }
            const value = `${formatNumber(segment.value)}${percent ? "%" : ""}`;
            if (p.mode !== "grouped") {
                valueText(frame, value, rect);
            } else if (horizontal) {
                const positive = segment.value >= 0;
                const x = b + (positive ? 5 : -5);
                fittedText(
                    frame,
                    value,
                    x,
                    side + thickness / 2 + 4,
                    positive ? width - x - 2 : x - r.x - 3,
                    palette.ink,
                    positive ? "left" : "right",
                );
            } else {
                fittedText(
                    frame,
                    value,
                    side + rect.w / 2,
                    b - 7,
                    thickness - 3,
                    palette.ink,
                    "center",
                );
            }
        });
    });
    const keysHeight = p.showLegend ? legendHeight(width, p.series.length) : 0;
    fittedText(
        frame,
        p.categoryLabel,
        r.x + r.w / 2,
        height - keysHeight - 12,
        r.w,
        palette.inkMuted,
        "center",
    );
    if (p.showLegend) {
        legend(frame, p.series, height - keysHeight + 4);
    }
}

export default defineFigure<BarModel>({
    duration: TIMES.end,
    height: 390,
    heightFor: (width, p) => chartHeight(width, p, p.series.length, plotHeight(p)),
    decode: decodeBar,
    table: (p) => ({
        columns: [p.categoryLabel || "Category", ...p.series.map((s) => s.label)],
        rows: p.categories.map((category, i) => [
            category,
            ...p.series.map((s) => s.values[i] ?? 0),
        ]),
        unit: p.unit,
    }),
    draw,
});
