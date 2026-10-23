/**
 * sequence — a sequence diagram whose messages take visible time.
 *
 * Actors stand side by side with a lifeline under each; time runs downward.
 * Each message leaves its sender at one moment and reaches the receiver at a
 * later one, so its arrow slants by the latency, and while it travels a
 * packet rides its tip. A lost message stops partway and bursts. A message
 * that `retransmits` a lost one gets a bracket on the sender's lifeline that
 * spans the wait, which is how a timeout reads in a protocol trace.
 *
 *   <Figure kind="sequence" props={{
 *     actors: [{ id: "c", label: "Client" }, { id: "s", label: "Server" }],
 *     messages: [
 *       { from: "c", to: "s", label: "SYN" },
 *       { from: "s", to: "c", label: "SYN-ACK" },
 *       { from: "c", to: "s", label: "ACK" },
 *     ],
 *   }} />
 *
 * Timing is in "story seconds", any unit you like: each message starts
 * `gap` after the previous one started (by default, when the previous one
 * arrived) and takes `latency` to arrive. The whole story is scaled to fit
 * both the canvas height and the animation, so a long exchange still fits.
 */

import {
    arr,
    arrow,
    box,
    burst,
    defineFigure,
    dot,
    ease,
    flash,
    labelSpot,
    line,
    maybe,
    num,
    obj,
    progress,
    slantedLabel,
    str,
    text,
    tone,
    toneColor,
    withAlpha,
    type Point,
    type Tone,
} from "#src/figures/kit.ts";
import type { JsonValue } from "#src/utils/json.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    /** Headers and lifelines fade in. */
    appear: 0.6,
    /** The first message leaves. */
    first: 0.7,
    /** The last message has arrived by this moment, whatever the story's length. */
    last: 8.4,
    /** Hold on the finished diagram. */
    hold: 1.4,
} as const;

/** How far a lost message gets before it bursts, as a share of the way. */
const LOST_AT = 0.55;

/* — 2. the story ——————————————————————————————————————————————————————— */

interface Actor {
    id: string;
    label: string;
    sub: string | undefined;
}

interface Message {
    from: number;
    to: number;
    label: string;
    lost: boolean;
    tone: Tone;
    /** Story time it leaves, and arrives (or bursts, if lost). */
    start: number;
    end: number;
    /** Index of the lost message this one resends. */
    retransmits: number | undefined;
}

interface Note {
    after: number;
    text: string;
}

interface Props {
    actors: Actor[];
    messages: Message[];
    notes: Note[];
    timeoutLabel: string;
    /** Story time at which the last thing happens. */
    total: number;
}

/* — 3. props ————————————————————————————————————————————————————————— */

function readActor(v: JsonValue, path: string): Actor {
    const o = obj(v, path);
    return {
        id: str(o.id, `${path}.id`),
        label: str(o.label, `${path}.label`),
        sub: maybe(o.sub, `${path}.sub`, str),
    };
}

export default defineFigure<Props>({
    duration: TIMES.last + TIMES.hold,
    height: 460,
    // A phone squeezes the arrows closer together while the labels stay the
    // same size, so the diagram grows taller there to keep messages apart. The
    // notes move to a legend underneath, which needs room too.
    heightFor: (width, props) =>
        width < 520
            ? 460 + Math.min(200, props.messages.length * 12) + props.notes.length * 17
            : 460,

    decode(raw) {
        const p = obj(raw, "props");
        const actors = arr(p.actors, "props.actors").map((a, i) =>
            readActor(a, `props.actors[${String(i)}]`),
        );
        if (actors.length < 2 || actors.length > 5)
        {
            throw new Error("props.actors needs 2 to 5 actors");
        }
        const ids = actors.map((a) => a.id);
        if (new Set(ids).size !== ids.length) {
            throw new Error("props.actors ids must be unique");
        }
        const actorIndex = (id: string, path: string) => {
            const i = ids.indexOf(id);
            if (i < 0)
            {
                throw new Error(
                    `${path} is "${id}", which is not one of the actor ids: ${ids.join(", ")}`,
                );
            }
            return i;
        };

        const messages: Message[] = [];
        for (const [i, m] of arr(p.messages, "props.messages").entries()) {
            const path = `props.messages[${String(i)}]`;
            const o = obj(m, path);
            const from = actorIndex(str(o.from, `${path}.from`), `${path}.from`);
            const to = actorIndex(str(o.to, `${path}.to`), `${path}.to`);
            if (from === to) {
                throw new Error(`${path} goes from an actor to itself`);
            }
            const latency = maybe(o.latency, `${path}.latency`, num) ?? 1;
            if (latency <= 0) {
                throw new Error(`${path}.latency must be more than 0`);
            }
            const prev = messages[i - 1];
            // By default a message leaves when the previous one has arrived.
            const gap = maybe(o.gap, `${path}.gap`, num) ?? (prev ? prev.end - prev.start : 0);
            if (gap < 0) {
                throw new Error(`${path}.gap must not be negative`);
            }
            const lost = o.lost === undefined ? false : o.lost === true;
            if (o.lost !== undefined && typeof o.lost !== "boolean")
            {
                throw new Error(`${path}.lost must be true or false`);
            }
            const retransmits = maybe(o.retransmits, `${path}.retransmits`, num);
            if (retransmits !== undefined) {
                const target = messages[retransmits];
                if (!Number.isInteger(retransmits) || !target?.lost) {
                    throw new Error(
                        `${path}.retransmits must be the index of an earlier lost message`,
                    );
                }
                if (target.from !== from)
                {
                    throw new Error(`${path} retransmits a message that a different actor sent`);
                }
            }
            const start = prev ? prev.start + gap : 0;
            messages.push({
                from,
                to,
                label: str(o.label, `${path}.label`),
                lost,
                tone: tone(o.tone, `${path}.tone`, retransmits !== undefined ? "marker" : "ink"),
                start,
                end: start + latency * (lost ? LOST_AT : 1),
                retransmits,
            });
        }
        if (messages.length === 0) {
            throw new Error("props.messages needs at least one message");
        }

        const notes = arr(p.notes ?? [], "props.notes").map((n, i) => {
            const path = `props.notes[${String(i)}]`;
            const o = obj(n, path);
            const after = num(o.after, `${path}.after`);
            if (!Number.isInteger(after) || after < 0 || after >= messages.length) {
                throw new Error(
                    `${path}.after must be the index of a message (0 to ${String(messages.length - 1)})`,
                );
            }
            return { after, text: str(o.text, `${path}.text`) };
        });

        return {
            actors,
            messages,
            notes,
            timeoutLabel: maybe(p.timeoutLabel, "props.timeoutLabel", str) ?? "Timeout",
            total: Math.max(...messages.map((m) => m.end)),
        };
    },

    draw(frame, props) {
        const { ctx, width, height, time, palette } = frame;

        /* layout: header row of actor boxes, then the time axis downward */
        const narrow = width < 520;
        const hasNotes = props.notes.length > 0;
        // Notes get a column on the right; on a phone they become numbers at
        // their message, listed in a legend under the diagram instead.
        const gutter = hasNotes && !narrow ? Math.min(200, width * 0.26) : 0;
        const legendH = hasNotes && narrow ? props.notes.length * 17 + 8 : 0;
        const boxW = narrow ? 70 : 104;
        const boxH = 34;
        const top = 4;
        const bodyTop = top + boxH + 22;
        const bodyBottom = height - 14 - legendH;
        // A timeout label sits outside the lifeline it brackets, so the outer
        // actors are pushed in far enough for it to fit.
        ctx.font = `600 11px ${palette.mono}`;
        const timeoutW = ctx.measureText(props.timeoutLabel).width + 24;
        const bracketed = new Set(
            props.messages.flatMap((m) => (m.retransmits === undefined ? [] : [m.from])),
        );
        const last = props.actors.length - 1;
        const padL = bracketed.has(0) ? Math.max(0, timeoutW - boxW / 2) : 0;
        const padR = bracketed.has(last) ? Math.max(0, timeoutW - boxW / 2) : 0;
        const spanW = width - gutter - boxW - padL - padR;
        const actorX = (i: number) => padL + boxW / 2 + (last === 0 ? 0 : (spanW * i) / last);

        // Story time → canvas y, and story time → animation time. Both are
        // fitted from the story's own length, so any exchange fits.
        const y = (s: number) => bodyTop + (s / props.total) * (bodyBottom - bodyTop);

        const at = (s: number) => TIMES.first + (s / props.total) * (TIMES.last - TIMES.first);
        const appear = ease.out(progress(time, 0, TIMES.appear));

        withAlpha(ctx, appear, () => {
            /* layer 1: lifelines and headers */
            for (const [i, actor] of props.actors.entries()) {
                const x = actorX(i);
                line(ctx, x, top + boxH, x, bodyBottom, palette.rule, 1, [4, 4]);
                box(ctx, x - boxW / 2, top, boxW, boxH, 6, palette.paper, palette.rule);
                text(frame, actor.label, x, top + (actor.sub ? 15 : 21), {
                    align: "center",
                    size: 13,
                    weight: 600,
                    color: palette.inkStrong,
                });
                if (actor.sub) {
                    text(frame, actor.sub, x, top + 28, {
                        align: "center",
                        mono: true,
                        size: 11,
                        color: palette.inkFaint,
                    });
                }
            }
            text(frame, "Time ↓", 0, bodyTop - 8, {
                mono: true,
                size: 11,
                color: palette.inkFaint,
            });

            /* layer 2: timeout brackets, behind the arrows they explain */
            for (const m of props.messages) {
                if (m.retransmits === undefined) {
                    continue;
                }
                const lost = props.messages[m.retransmits];
                if (!lost) {
                    continue;
                }
                const grow = progress(time, at(lost.start), at(m.start) - at(lost.start));
                if (grow <= 0) {
                    continue;
                }
                const outward = m.from === 0 || m.from !== last ? -12 : 12;
                const x = actorX(m.from) + outward;
                const y0 = y(lost.start);
                const y1 = y0 + (y(m.start) - y0) * grow;
                line(ctx, x, y0, x, y1, palette.warn, 2);
                line(ctx, x - 4, y0, x + 4, y0, palette.warn, 2);
                if (grow >= 1) {
                    line(ctx, x - 4, y1, x + 4, y1, palette.warn, 2);
                }
                const side = outward < 0 ? "right" : "left";
                withAlpha(ctx, progress(time, at(lost.end), 0.3), () => {
                    text(
                        frame,
                        props.timeoutLabel,
                        x + (side === "right" ? -8 : 8),
                        (y0 + y1) / 2 + 4,
                        {
                            align: side,
                            mono: true,
                            size: 11,
                            weight: 600,
                            color: palette.warn,
                        },
                    );
                });
            }

            /*
             * Where each label goes. A label sits just above its own arrow, slanted
             * along it, at the point of the arrow farthest from every other arrow:
             * when several messages are in flight their arrows cross in the middle,
             * and a label fixed at the midpoint lands on the crossings.
             */
            const segments = props.messages.map((m): [Point, Point] => {
                const a: Point = { x: actorX(m.from), y: y(m.start) };
                const full: Point = {
                    x: actorX(m.to),
                    y: y(m.start + (m.end - m.start) / (m.lost ? LOST_AT : 1)),
                };
                const reach = m.lost ? LOST_AT : 1;
                return [a, { x: a.x + (full.x - a.x) * reach, y: a.y + (full.y - a.y) * reach }];
            });
            const labelSize = narrow ? 11 : 12;
            ctx.font = `600 ${String(labelSize)}px ${palette.mono}`;
            const spots = props.messages.map((m, i) => {
                const seg = segments[i];
                if (!seg) {
                    return undefined;
                }
                return labelSpot(
                    seg,
                    ctx.measureText(m.label).width,
                    labelSize,
                    segments.filter((_, j) => j !== i),
                );
            });

            /* layer 3: messages — one question each: how far has it got? */
            const riders: { at: Point; color: string }[] = [];
            for (const [i, m] of props.messages.entries()) {
                const leave = at(m.start);
                if (time < leave) {
                    continue;
                }
                const a: Point = { x: actorX(m.from), y: y(m.start) };
                const full: Point = {
                    x: actorX(m.to),
                    y: y(m.start + (m.end - m.start) / (m.lost ? LOST_AT : 1)),
                };
                const reach = m.lost ? LOST_AT : 1;
                const t = progress(time, leave, at(m.end) - leave) * reach;
                const tip: Point = { x: a.x + (full.x - a.x) * t, y: a.y + (full.y - a.y) * t };
                const color = m.lost ? palette.danger : toneColor(palette, m.tone);
                const done = t >= reach;

                if (m.lost) {
                    line(ctx, a.x, a.y, tip.x, tip.y, color, 1.5, [5, 4]);
                } else if (done) {
                    arrow(ctx, a, full, color, 1.5);
                } else {
                    line(ctx, a.x, a.y, tip.x, tip.y, color, 1.5);
                }

                // The packet riding the tip is drawn after every label, below.
                if (!done)
                {
                    riders.push({ at: tip, color: m.lost ? palette.danger : palette.marker });
                }
                if (m.lost) {
                    burst(ctx, tip.x, tip.y, progress(time, at(m.end), 0.8), palette.danger);
                    // Once the burst has faded, a small × keeps the loss on the page.
                    if (done) {
                        const k = 3.5;
                        line(ctx, tip.x - k, tip.y - k, tip.x + k, tip.y + k, palette.danger, 2);
                        line(ctx, tip.x - k, tip.y + k, tip.x + k, tip.y - k, palette.danger, 2);
                    }
                }
                if (!m.lost && done) {
                    withAlpha(ctx, flash(time, at(m.end), 0.5), () => {
                        dot(ctx, full.x, full.y, 5, palette.marker);
                    });
                }

                // The label appears once the arrow has been drawn past its spot, so
                // it never floats ahead of the message.
                const spot = spots[i];
                if (spot) {
                    withAlpha(ctx, progress(t, spot.along * reach - 0.05, 0.12), () => {
                        slantedLabel(
                            frame,
                            m.label,
                            spot,
                            labelSize,
                            m.lost ? palette.danger : m.tone === "ink" ? palette.inkStrong : color,
                        );
                    });
                }
            }

            for (const r of riders) {
                dot(ctx, r.at.x, r.at.y, 4, r.color);
            }

            /* layer 4: notes, beside the message they comment on */
            for (const [n, note] of props.notes.entries()) {
                const m = props.messages[note.after];
                if (!m) {
                    continue;
                }
                withAlpha(ctx, progress(time, at(m.end), 0.4), () => {
                    const ny = y(m.end) + 4;
                    if (!narrow) {
                        line(
                            ctx,
                            width - gutter + 8,
                            ny - 4,
                            width - gutter + 16,
                            ny - 4,
                            palette.ruleFaint,
                        );
                        text(frame, note.text, width - gutter + 22, ny, {
                            size: 12,
                            color: palette.inkMuted,
                        });
                        return;
                    }
                    // A number beside the receiving lifeline, outside the arrows.
                    const out = bracketed.has(m.to) ? 28 : 12;
                    const lx = actorX(m.to) + (m.to === last ? out : -out);
                    dot(ctx, lx, ny - 4, 7, palette.surface);
                    text(frame, String(n + 1), lx, ny, {
                        align: "center",
                        mono: true,
                        size: 11,
                        weight: 600,
                        color: palette.inkMuted,
                    });
                    const ly = bodyBottom + 22 + n * 17;
                    dot(ctx, 7, ly - 4, 7, palette.surface);
                    text(frame, String(n + 1), 7, ly, {
                        align: "center",
                        mono: true,
                        size: 11,
                        weight: 600,
                        color: palette.inkMuted,
                    });
                    text(frame, note.text, 20, ly, { size: 12, color: palette.inkMuted });
                });
            }
        });
    },
});
