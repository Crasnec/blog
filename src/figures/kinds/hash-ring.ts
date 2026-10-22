/**
 * hash-ring — which keys change servers when one server is added.
 *
 * Keys and servers are placed by a real string hash, and ownership is worked
 * out before and after the new server joins, so the number of keys that move
 * is computed rather than chosen. Two schemes:
 *
 *   - `ring`: consistent hashing. Servers (and their virtual nodes) are points
 *     on a circle; a key belongs to the first server point clockwise from it.
 *     The new server only takes the keys in the slices just before its points.
 *   - `modulo`: `hash % N`. Changing N to N + 1 reassigns most keys.
 *
 * Ownership is never told apart by colour (the palette has one marker). The
 * right-hand panel is a column per server holding its keys; a key that moves
 * flies to its new column in the marker colour, and leaves a hole behind.
 *
 *   <Figure
 *       kind="hash-ring"
 *       props={{ scheme: "ring", servers: ["A", "B", "C"], add: "D", vnodes: 8 }}
 *   />
 */

import {
    alongCurve,
    arc,
    arr,
    bendPoint,
    box,
    center,
    chip,
    cols,
    defineFigure,
    dot,
    ease,
    flash,
    fittedText,
    label,
    line,
    maybe,
    num,
    obj,
    polar,
    progress,
    stagger,
    str,
    text,
    withAlpha,
    type Frame,
    type Rect,
} from "../kit.ts";

import type { JsonValue } from "../../utils/json.ts";
import { planHashing as plan, type Plan, type Key } from "../models/hash-ring.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    appear: 0.6,
    /** Keys pop in one after another over this span. */
    keysFrom: 0.3,
    keysSpan: 1.1,
    keyFade: 0.3,
    /** The new server appears. */
    add: 2.2,
    grow: 0.6,
    /** Moved keys fly to their new server, one after another. */
    moveFrom: 2.9,
    moveSpan: 1.8,
    move: 0.7,
    /** The final count, set against the ideal share. */
    verdict: 5.4,
} as const;

const DURATION = 6.4;

/* — 2. hashing and ownership ———————————————————————————————————————— */

function readCount(raw: JsonValue | undefined): number {
    const count = raw === undefined ? 24 : num(raw, "props.keys");
    if (!Number.isInteger(count) || count < 1 || count > 40)
        throw new Error("props.keys must be an integer from 1 to 40 or an array of key names");
    return count;
}

/* — 3. props ————————————————————————————————————————————————————————— */

export default defineFigure<Plan>({
    duration: DURATION,
    height: 360,

    decode(raw) {
        const p = obj(raw, "props");
        const scheme = str(p.scheme, "props.scheme");
        if (scheme !== "ring" && scheme !== "modulo") {
            throw new Error('props.scheme must be "ring" or "modulo"');
        }
        const servers = arr(p.servers, "props.servers").map((s, i) =>
            str(s, `props.servers[${String(i)}]`),
        );
        if (servers.length < 2 || servers.length > 6)
            throw new Error("props.servers needs 2 to 6 names");
        if (new Set(servers).size !== servers.length)
            throw new Error("props.servers must not repeat a name");
        if (servers.some((s) => s.length === 0 || s.length > 8)) {
            throw new Error("each name in props.servers must be 1 to 8 characters");
        }
        const add = str(p.add, "props.add");
        if (add.length === 0 || add.length > 8 || servers.includes(add)) {
            throw new Error("props.add must be a new 1–8 character name, not one of props.servers");
        }
        const names = Array.isArray(p.keys)
            ? arr(p.keys, "props.keys").map((v, i) => str(v, `props.keys[${String(i)}]`))
            : Array.from({ length: readCount(p.keys) }, (_, i) => `key-${String(i)}`);
        if (
            names.length < 1 ||
            names.length > 40 ||
            new Set(names).size !== names.length ||
            names.some((name) => name.length === 0 || name.length > 128)
        ) {
            throw new Error(
                "props.keys needs 1–40 distinct nonempty strings of at most 128 characters",
            );
        }
        if (scheme === "modulo" && p.vnodes !== undefined) {
            throw new Error('props.vnodes only applies to scheme "ring"');
        }
        const vnodes = maybe(p.vnodes, "props.vnodes", num) ?? 1;
        if (!Number.isInteger(vnodes) || vnodes < 1 || vnodes > 16) {
            throw new Error("props.vnodes must be a whole number from 1 to 16");
        }
        return plan(scheme, servers, add, names, vnodes);
    },

    draw(frame, plan) {
        const { width, height } = frame;
        const narrow = width < 520;
        const top = headerRows(frame, plan) === 2 ? 46 : 28;
        // Desktop: the mechanism on the left, the columns on the right.
        // Narrow: the columns take what they need at the bottom and the
        // mechanism gets the rest of the height above them.
        const columnsH = 22 + columnsBodyHeight(plan, width, height);
        const band = height - top - columnsH - 10;
        const left: Rect = narrow
            ? { x: 0, y: top, w: width, h: band }
            : { x: 0, y: top, w: width * 0.4, h: height - top };
        const right: Rect = narrow
            ? { x: 0, y: top + band + 10, w: width, h: columnsH }
            : { x: width * 0.44, y: top, w: width * 0.56, h: height - top };

        withAlpha(frame.ctx, ease.out(progress(frame.time, 0, TIMES.appear)), () => {
            drawHeader(frame, plan);
            if (plan.scheme === "ring") drawRing(frame, plan, left);
            else drawModulo(frame, plan, left, narrow);
            drawColumns(frame, plan, right);
        });
    },
});

/* — 4. drawing ——————————————————————————————————————————————————————— */

/** When key `k` starts and finishes moving; undefined for a key that stays. */
function moveTimes(plan: Plan, k: Key): { start: number; end: number } | undefined {
    if (k.moveRank < 0) return undefined;
    const start = stagger(
        k.moveRank,
        plan.moved,
        TIMES.moveFrom,
        Math.min(TIMES.moveSpan, plan.moved * 0.12),
    );
    return { start, end: start + TIMES.move };
}

const keyAppear = (plan: Plan, i: number) =>
    stagger(i, plan.keys.length, TIMES.keysFrom, TIMES.keysSpan);

/** Key tiles per row in a column of width `w`. */
const tilesPerRow = (w: number) => (w < 70 ? 2 : 3);

/**
 * How tall the column bodies need to be for the fullest column, with tiles at
 * their natural 18px, capped so they fit in the space there is.
 */
function columnsBodyHeight(plan: Plan, width: number, height: number): number {
    const narrow = width < 520;
    const panelW = narrow ? width : width * 0.56;
    const colW = (panelW - 8 * (plan.servers.length - 1)) / plan.servers.length;
    const rows = Math.ceil(plan.slots / tilesPerRow(colW));
    const natural = 8 + rows * 21 + 6;
    return Math.min(natural, narrow ? height * 0.5 : height - 50);
}

/** The header is one row, or two when the title and the count do not fit side by side. */
function headerRows(frame: Frame, plan: Plan): 1 | 2 {
    const { ctx, width, palette } = frame;
    ctx.font = `700 12px ${palette.sans}`;
    const titleW = ctx.measureText(headerTitle(plan)).width;
    ctx.font = `700 12px ${palette.mono}`;
    const countW = ctx.measureText(
        `Moved ${String(plan.keys.length)} / ${String(plan.keys.length)} · ideal ${String(plan.keys.length)}`,
    ).width;
    return titleW + countW + 24 > width ? 2 : 1;
}

function headerTitle(plan: Plan): string {
    if (plan.scheme === "modulo") return "Modulo · hash % N";
    return plan.vnodes > 1
        ? `Hash ring · ${String(plan.vnodes)} virtual nodes/server`
        : "Hash ring · one point/server";
}

function drawHeader(frame: Frame, plan: Plan) {
    const { width, time, palette } = frame;
    text(frame, headerTitle(plan), 0, 13, { size: 12, weight: 700, color: palette.inkStrong });
    // On two rows the count goes under the title, left-aligned.
    const two = headerRows(frame, plan) === 2;
    const countX = two ? 0 : width;
    const countY = two ? 31 : 13;

    const total = plan.keys.length;
    const landed = plan.keys.filter((k) => {
        const m = moveTimes(plan, k);
        return m !== undefined && time >= m.end;
    }).length;
    const ideal = Math.round(total / plan.servers.length);
    const verdict = progress(time, TIMES.verdict, 0.5);
    if (verdict <= 0) {
        const live = `Moved ${String(landed)} / ${String(total)}`;
        if (two)
            text(frame, live, countX, countY, {
                size: 12,
                mono: true,
                color: palette.inkMuted,
                align: "left",
            });
        else
            label(frame, live, countX, countY, {
                size: 12,
                mono: true,
                color: palette.inkMuted,
                maxX: width,
            });
        return;
    }
    // Close to the new server's fair share is good; far above means churn,
    // far below means the new server is barely used.
    const fair = Math.abs(plan.moved - ideal) <= Math.max(1, ideal * 0.5);
    const final = `Moved ${String(plan.moved)} / ${String(total)} · ideal ${String(ideal)}`;
    const style = {
        size: 12,
        weight: 700,
        mono: true,
        color: fair ? palette.marker : palette.danger,
    };
    withAlpha(frame.ctx, verdict, () => {
        if (two) text(frame, final, countX, countY, { ...style, align: "left" });
        else label(frame, final, countX, countY, { ...style, maxX: width });
    });
}

function drawRing(frame: Frame, plan: Plan, area: Rect) {
    const { ctx, time, palette } = frame;
    const c = center(area);
    const radius = Math.max(30, Math.min(area.w, area.h) / 2 - 24);
    const added = plan.servers.length - 1;
    const grow = ease.out(progress(time, TIMES.add, TIMES.grow));
    const points = grow > 0 ? plan.after : plan.before;

    /* layer 1: the ring, with the new server's slices drawn in the marker */
    ctx.beginPath();
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = 1.5;
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (const [i, p] of points.entries()) {
        if (p.server !== added) continue;
        // A server owns the slice from the previous point up to itself.
        const prev = points[(i + points.length - 1) % points.length]?.at ?? 0;
        const from = prev <= p.at ? prev : prev - 1;
        arc(ctx, c, radius, from + (p.at - from) * (1 - grow), p.at, palette.marker, 4);
    }

    /* layer 2: server points, labelled where there is room */
    let lastLabel = -1;
    for (const p of points) {
        const isNew = p.server === added;
        const alpha = isNew ? grow : 1;
        withAlpha(ctx, alpha, () => {
            const a = polar(c, radius - 7, p.at);
            const b = polar(c, radius + 7, p.at);
            line(ctx, a.x, a.y, b.x, b.y, isNew ? palette.marker : palette.inkStrong, 2);
            if (p.at - lastLabel > 0.03) {
                const at = polar(c, radius + 17, p.at);
                text(frame, plan.servers[p.server] ?? "", at.x, at.y + 4, {
                    align: "center",
                    size: 11,
                    weight: 700,
                    color: isNew ? palette.marker : palette.inkStrong,
                });
                lastLabel = p.at;
            }
        });
    }

    /* layer 3: keys, just inside the ring, in the marker once they have moved */
    for (const [i, k] of plan.keys.entries()) {
        const shown = progress(time, keyAppear(plan, i), TIMES.keyFade);
        if (shown <= 0) continue;
        const m = moveTimes(plan, k);
        const moving = m !== undefined && time >= m.start;
        const p = polar(c, radius - 15, k.at);
        withAlpha(ctx, shown, () => {
            dot(ctx, p.x, p.y, moving ? 3.5 : 3, moving ? palette.marker : palette.inkMuted);
        });
    }

    /* layer 4: the rule the ring follows, in the middle where it is empty */
    if (radius >= 64) {
        text(frame, "Clockwise to", c.x, c.y - 3, {
            align: "center",
            size: 11,
            color: palette.inkFaint,
        });
        text(frame, "the next server", c.x, c.y + 13, {
            align: "center",
            size: 11,
            color: palette.inkFaint,
        });
    }
}

function drawModulo(frame: Frame, plan: Plan, area: Rect, narrow: boolean) {
    const { ctx, time, palette } = frame;
    const before = plan.servers.length - 1;
    const changed = time >= TIMES.add;
    const n = changed ? before + 1 : before;

    /* layer 1: the rule, with N changing when the server is added */
    const y = area.y + 22;
    text(frame, "Server = hash(key) %", area.x, y, {
        size: 13,
        weight: 600,
        color: palette.inkStrong,
    });
    ctx.font = `600 13px ${palette.sans}`;
    const nx = area.x + ctx.measureText("Server = hash(key) % ").width;
    const pop = flash(time, TIMES.add, 0.6);
    box(
        ctx,
        nx - 3,
        y - 15,
        24,
        21,
        4,
        palette.paper,
        changed ? palette.marker : palette.rule,
        1 + pop,
    );
    text(frame, String(n), nx + 9, y, {
        align: "center",
        size: 13,
        weight: 700,
        mono: true,
        color: changed ? palette.marker : palette.inkStrong,
    });

    /* layer 2: the first few keys, before → after, so the reader sees why */
    const rows = Math.max(
        0,
        Math.min(plan.keys.length, Math.floor((area.h - 44) / 20), narrow ? 6 : 10),
    );
    const keyWidth = area.w * 0.27;
    const mappingWidth = (area.w - keyWidth - 8) / 2;
    for (let i = 0; i < rows; i++) {
        const k = plan.keys[i];
        if (!k) continue;
        const ry = area.y + 50 + i * 20;
        const shown = progress(time, keyAppear(plan, i), TIMES.keyFade);
        const m = moveTimes(plan, k);
        const moved = m !== undefined && time >= m.start;
        withAlpha(ctx, shown, () => {
            fittedText(frame, `${String(i)} ${k.name}`, area.x, ry, keyWidth - 4);
            fittedText(
                frame,
                `% ${String(before)} → ${plan.servers[k.before] ?? ""}`,
                area.x + keyWidth + 8,
                ry,
                mappingWidth - 6,
            );
            if (changed) {
                fittedText(
                    frame,
                    `% ${String(before + 1)} → ${plan.servers[k.after] ?? ""}`,
                    area.x + keyWidth + 8 + mappingWidth,
                    ry,
                    mappingWidth - 4,
                    k.after !== k.before && moved ? palette.marker : palette.inkFaint,
                );
            }
        });
    }
}

function drawColumns(frame: Frame, plan: Plan, area: Rect) {
    const { ctx, time, palette } = frame;
    const added = plan.servers.length - 1;
    const grow = ease.out(progress(time, TIMES.add, TIMES.grow));
    const columns = cols(area, plan.servers.length, 8);

    const perRow = tilesPerRow(columns[0]?.w ?? 60);
    const rowsNeeded = Math.ceil(plan.slots / perRow);
    // Columns are as tall as the fullest one needs, not the whole panel.
    const bodyH = Math.min(area.h - 22, columnsBodyHeight(plan, frame.width, frame.height));
    const chipW = ((columns[0]?.w ?? 60) - 8 - (perRow - 1) * 3) / perRow;
    const chipH = Math.min(18, (bodyH - 14 - (rowsNeeded - 1) * 3) / rowsNeeded);
    const body = (col: Rect): Rect => ({ x: col.x, y: col.y + 22, w: col.w, h: bodyH });
    const slot = (server: number, s: number): Rect => {
        const col = columns[server] ?? area;
        const b = body(col);
        return {
            x: b.x + 4 + (s % perRow) * (chipW + 3),
            y: b.y + 4 + Math.floor(s / perRow) * (chipH + 3),
            w: chipW,
            h: chipH,
        };
    };

    /* layer 1: one column per server; the new one is a dashed outline until it joins */
    for (const [s, col] of columns.entries()) {
        const isNew = s === added;
        const count = plan.keys.filter((k, i) => {
            if (time < keyAppear(plan, i)) return false;
            const m = moveTimes(plan, k);
            const landed = m !== undefined && time >= m.end;
            return (landed ? k.after : k.before) === s;
        }).length;
        const b = body(col);
        if (isNew && grow <= 0) {
            ctx.setLineDash([3, 3]);
            box(ctx, b.x, b.y, b.w, b.h, 6, null, palette.rule);
            ctx.setLineDash([]);
            text(frame, `+${plan.servers[s] ?? ""}`, col.x + 2, col.y + 13, {
                size: 12,
                weight: 700,
                color: palette.inkFaint,
            });
            continue;
        }
        box(
            ctx,
            b.x,
            b.y,
            b.w,
            b.h,
            6,
            palette.paper,
            isNew ? palette.marker : palette.rule,
            isNew ? 1 + grow : 1,
        );
        text(frame, plan.servers[s] ?? "", col.x + 2, col.y + 13, {
            size: 12,
            weight: 700,
            color: isNew ? palette.marker : palette.inkStrong,
        });
        text(frame, String(count), col.x + col.w - 2, col.y + 13, {
            align: "right",
            mono: true,
            size: 11,
            color: palette.inkFaint,
        });
    }

    /* layer 2: keys at rest, then layer 3: keys in flight, on top */
    const flying: (() => void)[] = [];
    for (const [i, k] of plan.keys.entries()) {
        const shown = progress(time, keyAppear(plan, i), TIMES.keyFade);
        if (shown <= 0) continue;
        const m = moveTimes(plan, k);
        const from = slot(k.before, k.slotBefore);
        if (!m || time < m.start) {
            withAlpha(ctx, shown, () => {
                chip(frame, from, i, palette.inkMuted);
            });
            continue;
        }
        const to = slot(k.after, k.slotAfter);
        if (time >= m.end) {
            chip(frame, to, i, palette.marker);
            continue;
        }
        const t = ease.inOut(progress(time, m.start, TIMES.move));
        const a = center(from);
        const b = center(to);
        const p = alongCurve(a, bendPoint(a, b, -28), b, t);
        flying.push(() => {
            chip(frame, { ...from, x: p.x - from.w / 2, y: p.y - from.h / 2 }, i, palette.marker);
        });
    }
    for (const paint of flying) paint();
}
