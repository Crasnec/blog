/** Shared chart layout, axes and theme-aware series keys. */
import {
    fittedText,
    formatNumber,
    line,
    scale,
    text,
    toneColor,
    type Frame,
    type Rect,
    type Tone,
} from "#src/figures/kit.ts";
import type { Domain, Options } from "#src/figures/charts/model.ts";

export interface Key {
    label: string;
    tone: Tone;
}

export function legendHeight(width: number, count: number): number {
    return Math.ceil(count / (width < 480 ? 1 : 2)) * 26;
}

/** Shape patterns supplement colour; each entry retains its pattern in every view. */
export function shape(
    frame: Frame,
    path: Path2D,
    bounds: Rect,
    index: number,
    tone: Tone,
    overlay = false,
): void {
    const { ctx, palette } = frame;
    const color = toneColor(palette, tone);
    ctx.save();
    if (!overlay) {
        ctx.fillStyle = palette.paper;
        ctx.fill(path);
    }
    ctx.fillStyle = color;
    ctx.globalAlpha *= overlay ? 0.22 : index === 0 ? 0.72 : 0.12 + (index % 3) * 0.12;
    ctx.fill(path);
    ctx.restore();
    if (index >= 2) {
        ctx.save();
        ctx.clip(path);
        ctx.globalAlpha *= 0.48;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const spacing = index >= 5 ? 6 : 10;
        for (let d = -bounds.h; d < bounds.w + bounds.h; d += spacing) {
            const x = bounds.x + d;
            if (index % 3 === 0) {
                ctx.moveTo(x, bounds.y);
                ctx.lineTo(x, bounds.y + bounds.h);
            } else {
                const slope = index % 3 === 1 ? -1 : 1;
                ctx.moveTo(x, bounds.y);
                ctx.lineTo(x + slope * bounds.h, bounds.y + bounds.h);
            }
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke(path);
}

export function swatch(frame: Frame, x: number, y: number, index: number, tone: Tone): void {
    const path = new Path2D();
    path.rect(x, y, 16, 11);
    shape(frame, path, { x, y, w: 16, h: 11 }, index, tone);
}

export function legend(frame: Frame, keys: Key[], y: number): void {
    const columns = frame.width < 480 ? 1 : 2;
    const cell = (frame.width - 8) / columns;
    keys.forEach((key, i) => {
        const x = 4 + (i % columns) * cell;
        const top = y + Math.floor(i / columns) * 26;
        swatch(frame, x, top, i, key.tone);
        fittedText(frame, key.label, x + 24, top + 10, cell - 32, frame.palette.ink);
    });
}

export function header(frame: Frame, options: Options, valueLabel = ""): void {
    fittedText(frame, options.title, 4, 16, frame.width - 8, frame.palette.inkStrong);
    const unit = [valueLabel, options.unit].filter(Boolean).join(" · ");
    fittedText(frame, unit, 4, 38, frame.width - 8);
}

export function chartHeight(width: number, options: Options, count: number, plot = 230): number {
    return 110 + plot + (options.showLegend ? legendHeight(width, count) : 0);
}

export function chartRect(frame: Frame, options: Options, count: number, domain: Domain): Rect {
    frame.ctx.font = `400 11px ${frame.palette.sans}`;
    const labelWidth = Math.max(
        ...domain.ticks.map((v) => frame.ctx.measureText(formatNumber(v)).width),
    );
    const left = Math.min(frame.width * 0.3, Math.max(32, labelWidth + 10));
    const keyHeight = options.showLegend ? legendHeight(frame.width, count) : 0;
    return {
        x: left,
        y: 60,
        w: Math.max(1, frame.width - left - 24),
        h: Math.max(20, frame.height - 110 - keyHeight),
    };
}

export function yAxis(frame: Frame, rect: Rect, domain: Domain): (v: number) => number {
    const y = scale(domain.min, domain.max, rect.y + rect.h, rect.y);
    for (const tick of domain.ticks) {
        const py = y(tick);
        line(
            frame.ctx,
            rect.x,
            py,
            rect.x + rect.w,
            py,
            tick === 0 ? frame.palette.inkMuted : frame.palette.ruleFaint,
        );
        fittedText(
            frame,
            formatNumber(tick),
            rect.x - 8,
            py + 4,
            rect.x - 10,
            frame.palette.inkMuted,
            "right",
        );
    }
    return y;
}

export function valueText(frame: Frame, value: string, rect: Rect): void {
    const { ctx, palette } = frame;
    ctx.font = `400 11px ${palette.sans}`;
    const width = ctx.measureText(value).width;
    if (width + 8 > rect.w || rect.h < 18) {
        return;
    }
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;
    ctx.save();
    ctx.globalAlpha *= 0.94;
    ctx.fillStyle = palette.paper;
    ctx.fillRect(x - width / 2 - 3, y - 8, width + 6, 16);
    ctx.restore();
    text(frame, value, x, y + 4, { size: 11, align: "center", color: palette.inkStrong });
}
