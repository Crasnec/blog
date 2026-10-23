/** Part-to-whole comparisons; zero-valued slices retain their legend entry. */
import { defineFigure, ease, fittedText, formatNumber, progress } from "../kit.ts";
import { decodePie, type PieModel } from "../charts/model.ts";
import { header, shape, swatch } from "../charts/draw.ts";

const TIMES = { start: 0.15, reveal: 1.3, end: 1.8 };

export default defineFigure<PieModel>({
    duration: TIMES.end,
    height: 390,
    heightFor: (width, p) =>
        width < 520
            ? 290 + (p.showLegend ? p.slices.length * 40 : 0)
            : Math.max(300, 70 + (p.showLegend ? p.slices.length * 40 : 0)),
    decode: decodePie,
    table: (p) => ({
        columns: ["Category", "Value", "%"],
        rows: p.slices.map((s) => [s.label, s.value, Number(s.percent.toPrecision(6))]),
        unit: p.unit,
    }),
    draw(frame, p) {
        const { ctx, palette, width, height } = frame;
        header(frame, p);
        const sideBySide = width >= 520 && p.showLegend;
        const diameter = Math.min(sideBySide ? width * 0.45 : width - 24, 220);
        const radius = diameter / 2;
        const cx = sideBySide ? diameter / 2 + 8 : width / 2;
        const cy = sideBySide ? (height + 45) / 2 : 54 + radius;
        const inner = p.variant === "donut" ? radius * 0.6 : 0;
        const bounds = { x: cx - radius, y: cy - radius, w: diameter, h: diameter };
        const t = ease.out(progress(frame.time, TIMES.start, TIMES.reveal));
        // A faint outline makes the unrevealed portion legible from the first frame.
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = palette.ruleFaint;
        ctx.lineWidth = 1;
        ctx.stroke();
        p.slices.forEach((slice, i) => {
            if (slice.value === 0 || t === 0) {
                return;
            }
            const start = -Math.PI / 2 + slice.from * Math.PI * 2 * t;
            const end = -Math.PI / 2 + slice.to * Math.PI * 2 * t;
            const path = new Path2D();
            path.arc(cx, cy, radius, start, end);
            if (inner > 0) {
                path.arc(cx, cy, inner, end, start, true);
            } else {
                path.lineTo(cx, cy);
            }
            path.closePath();
            shape(frame, path, bounds, i, slice.tone);
        });
        if (inner > 0 && p.showValues) {
            fittedText(
                frame,
                formatNumber(p.total),
                cx,
                cy + (p.totalLabel ? -2 : 4),
                inner * 1.6,
                palette.inkStrong,
                "center",
            );
            fittedText(frame, p.totalLabel, cx, cy + 18, inner * 1.6, palette.inkMuted, "center");
        }
        if (p.showLegend) {
            const left = sideBySide ? diameter + 30 : 4;
            const top = sideBySide ? 60 : cy + radius + 24;
            p.slices.forEach((slice, i) => {
                const y = top + i * 40;
                swatch(frame, left, y, i, slice.tone);
                fittedText(frame, slice.label, left + 24, y + 10, width - left - 28, palette.ink);
                if (p.showValues) {
                    fittedText(
                        frame,
                        `${formatNumber(slice.value)} · ${formatNumber(slice.percent)}%`,
                        left + 24,
                        y + 25,
                        width - left - 28,
                    );
                }
            });
        }
    },
});
