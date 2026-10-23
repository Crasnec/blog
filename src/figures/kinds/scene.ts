/** Coordinate-free scenes assembled from a checked catalog and semantic steps. */
import {
    alongPath,
    arrowHead,
    box,
    defineFigure,
    dot,
    ease,
    fittedText,
    partialPath,
    text,
    toneColor,
    withAlpha,
    type Frame,
} from "#src/figures/kit.ts";
import {
    characters,
    decodeScene,
    layoutScene,
    sceneState,
    SCENE_DURATION,
    type PlacedItem,
    type SceneModel,
} from "#src/figures/scene/model.ts";
import { symbols, type SymbolName } from "#src/figures/scene/symbols.ts";

const paths = new Map<SymbolName, Path2D>();

/** Wrapping is measured, never guessed by the author; complete graphemes stay together. */
function wrap(frame: Frame, value: string, width: number, size: number): string[] {
    frame.ctx.font = `400 ${String(size)}px ${frame.palette.sans}`;
    const lines: string[] = [];
    let current = "";
    for (const character of characters(value)) {
        if (current && frame.ctx.measureText(current + character).width > width) {
            const space = current.lastIndexOf(" ");
            if (space > current.length / 2) {
                lines.push(current.slice(0, space));
                current = current.slice(space + 1) + character;
            } else {
                lines.push(current);
                current = character.trimStart();
            }
        } else {
            current += character;
        }
    }
    if (current) {
        lines.push(current.trimEnd());
    }
    return lines;
}

function card(frame: Frame, placed: PlacedItem, focused: boolean, alpha: number): void {
    const { ctx, palette } = frame;
    const { item, x, y, w, h } = placed;
    const color = focused ? palette.marker : toneColor(palette, item.tone);
    withAlpha(ctx, alpha, () => {
        box(ctx, x, y, w, h, 9, palette.paper, focused ? color : palette.rule, focused ? 1.5 : 1);
        if (focused) {
            withAlpha(ctx, 0.08, () => { box(ctx, x, y, w, h, 9, palette.marker); });
        }
        const path = paths.get(item.visual) ?? new Path2D(symbols[item.visual].path);
        paths.set(item.visual, path);
        ctx.save();
        ctx.translate(x + w / 2 - 20, y + 17);
        ctx.scale(40 / 24, 40 / 24);
        ctx.lineWidth = 1.35;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke(path);
        ctx.restore();
        let baseline = y + 80;
        for (const value of wrap(frame, item.label, w - 28, 12)) {
            text(frame, value, x + w / 2, baseline, {
                size: 12,
                align: "center",
                color: palette.inkStrong,
            });
            baseline += 16;
        }
        if (item.detail) {
            baseline += 5;
            for (const value of wrap(frame, item.detail, w - 28, 11)) {
                text(frame, value, x + w / 2, baseline, {
                    size: 11,
                    align: "center",
                    color: palette.inkMuted,
                });
                baseline += 14;
            }
        }
    });
}

export default defineFigure<SceneModel>({
    duration: SCENE_DURATION,
    height: 400,
    heightFor: (width, p) => layoutScene(width, p).height,
    decode: decodeScene,
    table: (p) => ({
        columns: ["Item", "Description", "Parent"],
        rows: p.items.map((item) => [
            item.label,
            item.detail,
            p.items.find((candidate) => candidate.id === item.parent)?.label ?? "",
        ]),
        unit: p.title,
    }),
    draw(frame, p) {
        const { ctx, palette, time, width } = frame;
        const layout = layoutScene(width, p);
        const state = sceneState(p, time);
        fittedText(frame, p.title, 10, 18, width - 20, palette.inkStrong);
        for (const route of layout.routes) {
            const active =
                state.step?.action === "transfer" &&
                state.step.from === route.from &&
                state.step.to === route.to;
            ctx.strokeStyle = palette.rule;
            ctx.lineWidth = 1.2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            partialPath(ctx, route.points, 1);
            const end = route.points.at(-1);
            const before = route.points.at(-2);
            if (end && before) {
                arrowHead(
                    ctx,
                    end,
                    Math.atan2(end.y - before.y, end.x - before.x),
                    active ? palette.marker : palette.inkFaint,
                    5,
                );
            }
            if (active) {
                ctx.strokeStyle = palette.marker;
                ctx.lineWidth = 2;
                partialPath(ctx, route.points, ease.inOut(state.progress));
                if (state.active >= 0) {
                    const point = alongPath(route.points, ease.inOut(state.progress));
                    dot(ctx, point.x, point.y, 4, palette.marker);
                }
            }
        }
        const reveals = new Set(
            p.steps.flatMap((step) => (step.action === "reveal" ? [step.target] : [])),
        );
        for (const placed of layout.items) {
            const dim = reveals.has(placed.item.id) && !state.revealed.has(placed.item.id);
            card(frame, placed, placed.item.id === state.target, dim ? 0.4 : 1);
        }
    },
});
