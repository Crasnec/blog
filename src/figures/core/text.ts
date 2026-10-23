import type { Frame } from "#src/figures/core/definition.ts";
import type { Rect, LabelSpot } from "#src/figures/core/geometry.ts";
import { box, dot, withAlpha } from "#src/figures/core/paint.ts";
import { clamp } from "#src/figures/core/time.ts";

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

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Draw text within a width, preserving complete graphemes when truncating. */
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
        ) {
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
