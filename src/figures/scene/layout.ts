import type { Item, SceneModel, Layout, PlacedItem, Route } from "#src/figures/scene/types.ts";
import { characters } from "#src/figures/scene/text.ts";
import type { Point } from "#src/figures/kit.ts";

function cardHeight(width: number, items: Item[]): number {
    const capacity = Math.max(1, Math.floor((width - 28) / 16));
    return Math.max(
        ...items.map(
            (item) =>
                78 +
                Math.ceil(characters(item.label).length / capacity) * 16 +
                (item.detail ? Math.ceil(characters(item.detail).length / capacity) * 14 + 6 : 0),
        ),
    );
}

export function layoutScene(width: number, model: SceneModel): Layout {
    const margin = 10;
    const gap = 44;
    const top = model.title ? 42 : 12;
    const usable = Math.max(120, width - margin * 2);
    const n = model.items.length;
    const placed: PlacedItem[] = [];
    const maxDepth = Math.max(...model.items.map((item) => item.depth));
    const indent = Math.min(24, (usable - 130) / Math.max(1, maxDepth));
    const compact = model.layout === "hierarchy";
    const horizontal = model.layout === "flow" && n * 150 + (n - 1) * gap <= usable;
    const ringWidth = 126;
    const ringHeight = cardHeight(ringWidth, model.items);
    const radius = (Math.hypot(ringWidth, ringHeight) + 24) / (2 * Math.sin(Math.PI / n));
    const ring = model.layout === "cycle" && 2 * radius + ringWidth <= usable;
    let height: number;
    if (model.layout === "grid" || horizontal) {
        const columns = horizontal
            ? n
            : Math.min(4, n, Math.max(1, Math.floor((usable + 18) / 154)));
        const gutter = horizontal ? gap : 18;
        const w = (usable - (columns - 1) * gutter) / columns;
        const h = cardHeight(w, model.items);
        model.items.forEach((item, i) =>
            placed.push({
                item,
                x: margin + (i % columns) * (w + gutter),
                y: top + Math.floor(i / columns) * (h + 18),
                w,
                h,
            }),
        );
        height = top + Math.ceil(n / columns) * (h + 18);
    } else if (ring) {
        const center = { x: width / 2, y: top + radius + ringHeight / 2 };
        model.items.forEach((item, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / n;
            placed.push({
                item,
                x: center.x + radius * Math.cos(angle) - ringWidth / 2,
                y: center.y + radius * Math.sin(angle) - ringHeight / 2,
                w: ringWidth,
                h: ringHeight,
            });
        });
        height = Math.max(...placed.map((item) => item.y + item.h)) + 12;
    } else {
        const w = Math.min(
            300,
            usable - (compact ? maxDepth * indent : model.layout === "cycle" ? 28 : 0),
        );
        const h = cardHeight(w, model.items);
        model.items.forEach((item, i) =>
            placed.push({
                item,
                x: compact ? margin + item.depth * indent : (width - w) / 2,
                y: top + i * (h + gap),
                w,
                h,
            }),
        );
        height = top + n * (h + gap) - gap + 12;
    }
    const byId = new Map(placed.map((item) => [item.item.id, item]));
    const routes = model.links.map((link): Route => {
        const a = byId.get(link.from);
        const b = byId.get(link.to);
        if (!a || !b) {
            throw new Error("Scene layout lost a validated item");
        }
        let points: Point[];
        if (compact) {
            const bus = a.x + 10;
            points = [
                { x: bus, y: a.y + a.h },
                { x: bus, y: b.y + b.h / 2 },
                { x: b.x, y: b.y + b.h / 2 },
            ];
        } else if (horizontal) {
            points = [
                { x: a.x + a.w, y: a.y + a.h / 2 },
                { x: b.x, y: b.y + b.h / 2 },
            ];
        } else if (ring) {
            const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
            const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
            const dx = bc.x - ac.x;
            const dy = bc.y - ac.y;
            const factor = Math.min(a.w / 2 / Math.abs(dx), a.h / 2 / Math.abs(dy));
            points = [
                { x: ac.x + dx * factor, y: ac.y + dy * factor },
                { x: bc.x - dx * factor, y: bc.y - dy * factor },
            ];
        } else if (b.y < a.y) {
            const right = width - 3;
            points = [
                { x: a.x + a.w, y: a.y + a.h / 2 },
                { x: right, y: a.y + a.h / 2 },
                { x: right, y: b.y + b.h / 2 },
                { x: b.x + b.w, y: b.y + b.h / 2 },
            ];
        } else {
            points = [
                { x: a.x + a.w / 2, y: a.y + a.h },
                { x: b.x + b.w / 2, y: b.y },
            ];
        }
        return { ...link, points };
    });
    return { height: Math.ceil(height), items: placed, routes };
}
