/**
 * state-machine — states as boxes, transitions as curved arrows, and a stream
 * of input events along the bottom that drives the machine.
 *
 * For "what state is it in, and why": a circuit breaker, a TCP connection, an
 * order going through checkout, a deploy pipeline. Each event lights up on the
 * timeline as time reaches it; if it fires a transition, a token runs along
 * that arrow, the arrow flashes, and the highlight moves to the new state. A
 * transition with `count` fires only on the n-th matching event in a row, and
 * its label counts up as the events arrive, which is how thresholds such as
 * "three failures in a row" are shown.
 *
 * Which event fires which transition is worked out in `decode` from the
 * transition table, not placed by hand, so the picture cannot disagree with
 * the rules written next to it.
 *
 *   <Figure kind="state-machine" props={{
 *     states: [
 *       { id: "closed", label: "CLOSED", x: 0, y: 0.75 },
 *       { id: "open", label: "OPEN", x: 1, y: 0.75 },
 *     ],
 *     start: "closed",
 *     events: [{ id: "fail", label: "Failure", tone: "fail" }],
 *     transitions: [{ from: "closed", to: "open", on: "fail", count: 3 }],
 *     inputs: [{ at: 1, event: "fail" }, { at: 1.6, event: "fail" }, { at: 2.2, event: "fail" }],
 *   }} />
 *
 * Positions are fractions of the diagram area, as in `flow`. A pair of
 * transitions in opposite directions bends apart on its own; a transition
 * whose `from` and `to` are the same state is drawn as a loop.
 */

import {
	alongCurve,
	arc,
	arr,
	arrowHead,
	bendPoint,
	box,
	clamp,
	curvedArrow,
	defineFigure,
	dot,
	ease,
	edgePoint,
	flash,
	label,
	line,
	maybe,
	num,
	obj,
	polar,
	progress,
	ring,
	scale,
	str,
	text,
	withAlpha,
	type Frame,
	type Palette,
	type Point,
} from "../kit.ts";

import { EVENT_TONES, runMachine as run, type EventTone, type State, type EventKind, type Transition, type Step } from "../models/state-machine.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
	/** Boxes and arrows fade in. */
	appear: 0.6,
	/** A token's trip along a transition; the highlight moves when it lands. */
	travel: 0.55,
	/** How long a fired arrow stays lit. */
	flash: 0.9,
	/** Inputs must sit inside [earliest, duration - tail]. */
	earliest: 0.4,
	tail: 1,
} as const;

const DURATION = 12;

/* — 2. the machine ————————————————————————————————————————————————————— */


/* — 3. props ————————————————————————————————————————————————————————— */

interface Props {
	states: State[];
	start: number;
	events: EventKind[];
	transitions: Transition[];
	steps: Step[];
}

export default defineFigure<Props>({
	duration: DURATION,
	height: 380,

	decode(raw) {
		const p = obj(raw, "props");

		const states = arr(p.states, "props.states").map((s, i) => {
			const path = `props.states[${String(i)}]`;
			const o = obj(s, path);
			return {
				id: str(o.id, `${path}.id`),
				label: str(o.label, `${path}.label`),
				x: clamp(num(o.x, `${path}.x`)),
				y: clamp(num(o.y, `${path}.y`)),
			};
		});
		if (states.length < 2) throw new Error("props.states needs at least two states");
		const stateIndex = (id: string, path: string) => {
			const i = states.findIndex((s) => s.id === id);
			if (i < 0) {
				throw new Error(`${path} is "${id}", which is not one of the states: ${states.map((s) => s.id).join(", ")}`);
			}
			return i;
		};
		for (const [i, s] of states.entries()) {
			if (states.findIndex((o) => o.id === s.id) !== i) throw new Error(`props.states has "${s.id}" twice`);
		}

		const events = arr(p.events, "props.events").map((e, i) => {
			const path = `props.events[${String(i)}]`;
			const o = obj(e, path);
			const tone = maybe(o.tone, `${path}.tone`, str) ?? "ok";
			const found = EVENT_TONES.find((t) => t === tone);
			if (!found) throw new Error(`${path}.tone must be one of ${EVENT_TONES.join(", ")}`);
			return { id: str(o.id, `${path}.id`), label: str(o.label, `${path}.label`), tone: found };
		});
		const eventId = (id: string, path: string) => {
			if (!events.some((e) => e.id === id)) {
				throw new Error(`${path} is "${id}", which is not one of the events: ${events.map((e) => e.id).join(", ")}`);
			}
			return id;
		};

		const transitions = arr(p.transitions, "props.transitions").map((t, i) => {
			const path = `props.transitions[${String(i)}]`;
			const o = obj(t, path);
			const count = maybe(o.count, `${path}.count`, num) ?? 1;
			if (!Number.isInteger(count) || count < 1) throw new Error(`${path}.count must be a whole number of 1 or more`);
			const on = eventId(str(o.on, `${path}.on`), `${path}.on`);
			return {
				from: stateIndex(str(o.from, `${path}.from`), `${path}.from`),
				to: stateIndex(str(o.to, `${path}.to`), `${path}.to`),
				on,
				count,
				label: maybe(o.label, `${path}.label`, str) ?? events.find((e) => e.id === on)?.label ?? on,
				bend: maybe(o.bend, `${path}.bend`, num),
			};
		});
		for (const [i, t] of transitions.entries()) {
			const twin = transitions.findIndex((o, j) => j !== i && o.from === t.from && o.on === t.on);
			if (twin >= 0) {
				throw new Error(
					`props.transitions[${String(i)}] and [${String(twin)}] both leave "${states[t.from]?.id ?? ""}" on "${t.on}"; ` +
						"a state machine needs one transition per state and event",
				);
			}
		}

		const inputs = arr(p.inputs, "props.inputs").map((e, i) => {
			const path = `props.inputs[${String(i)}]`;
			const o = obj(e, path);
			const at = num(o.at, `${path}.at`);
			if (at < TIMES.earliest || at > DURATION - TIMES.tail) {
				throw new Error(`${path}.at must be between ${String(TIMES.earliest)} and ${String(DURATION - TIMES.tail)} seconds`);
			}
			return { at, event: eventId(str(o.event, `${path}.event`), `${path}.event`) };
		});
		for (let i = 1; i < inputs.length; i++) {
			const gap = (inputs[i]?.at ?? 0) - (inputs[i - 1]?.at ?? 0);
			// The next input cannot start a trip before the previous one lands.
			if (gap + 1e-9 < TIMES.travel) {
				throw new Error(
					`props.inputs[${String(i)}] comes ${gap.toFixed(2)}s after the one before; keep them at least ${String(TIMES.travel)}s apart and in order`,
				);
			}
		}

		const start = stateIndex(maybe(p.start, "props.start", str) ?? states[0]?.id ?? "", "props.start");
		return { states, start, events, transitions, steps: run(start, transitions, inputs) };
	},

	draw(frame, props) {
		const { ctx, width, height, time, palette } = frame;
		// Fonts must match `drawStates`, which is what the widths are measured for.
		const narrow = width < 520;
		const stripH = narrow ? 76 : 104;
		const diagram = { x: 0, y: 0, w: width, h: height - stripH };

		/* layout: box sizes first, so centres can be clamped to fit them */
		ctx.font = `600 ${String(narrow ? 12 : 13)}px ${palette.sans}`;
		const boxH = narrow ? 34 : 40;
		const boxW = props.states.map((s) => Math.max(narrow ? 60 : 84, ctx.measureText(s.label).width + (narrow ? 20 : 30)));
		const loopRoom = 34;
		const centres = props.states.map((s, i): Point => {
			const half = (boxW[i] ?? 80) / 2 + 2;
			const padY = boxH / 2 + loopRoom;
			return {
				x: clamp(diagram.x + half + s.x * (diagram.w - half * 2), half, width - half),
				y: diagram.y + padY + s.y * (diagram.h - padY * 2),
			};
		});

		/* the machine at `time`: which state holds the highlight, and which trip is under way */
		const fired = props.steps.filter((s) => s.fired !== undefined);
		const landed = fired.filter((s) => time >= s.at + TIMES.travel);
		const lastLanded = landed[landed.length - 1];
		const current = lastLanded?.fired === undefined ? props.start : (props.transitions[lastLanded.fired]?.to ?? props.start);
		const trip = fired.find((s) => time >= s.at && time < s.at + TIMES.travel);

		const appear = ease.out(progress(time, 0, TIMES.appear));
		withAlpha(ctx, appear, () => {
			drawTransitions(frame, props, centres, boxW, boxH, narrow);
			drawStates(frame, props, centres, boxW, boxH, current, trip);
			drawToken(frame, props, centres, boxW, boxH, trip);
			drawStrip(frame, props, { x: 0, y: height - stripH, w: width, h: stripH }, narrow);
		});
	},
});

/* — 4. drawing ——————————————————————————————————————————————————————— */

interface Geometry {
	kind: "curve" | "loop";
	a: Point;
	b: Point;
	c: Point;
	/** Sideways bend of a curve, in pixels; positive bends left of travel. */
	bend: number;
	/** Loops: circle centre, radius, start and end turn. */
	loop?: { centre: Point; r: number; from: number; to: number };
	labelAt: Point;
}

/** The drawn shape of transition `i`, shared by the arrows, the token and the labels. */
function geometry(props: Props, i: number, centres: Point[], boxW: number[], boxH: number, height: number): Geometry | undefined {
	const t = props.transitions[i];
	if (!t) return undefined;
	const from = centres[t.from];
	const to = centres[t.to];
	if (!from || !to) return undefined;

	if (t.from === t.to) {
		// A loop sits on the side of the box with more room: above in the lower
		// half of the diagram, below in the upper half.
		const above = from.y > height / 2;
		const r = 13;
		const centre = { x: from.x, y: above ? from.y - boxH / 2 - r + 3 : from.y + boxH / 2 + r - 3 };
		const loop = above ? { centre, r, from: 0.62, to: 1.38 } : { centre, r, from: 0.12, to: 0.88 };
		const labelAt = { x: centre.x, y: above ? centre.y - r - 6 : centre.y + r + 16 };
		return { kind: "loop", a: from, b: from, c: from, bend: 0, loop, labelAt };
	}

	// Opposite pairs bend apart by default; a lone arrow stays nearly straight.
	const reverse = props.transitions.some((o) => o.from === t.to && o.to === t.from);
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	const bend = t.bend ?? (reverse ? Math.min(34, dist * 0.18) : Math.min(18, dist * 0.08));
	const control = bendPoint(from, to, bend);
	const a = edgePoint(from, boxW[t.from] ?? 80, boxH, control);
	const b = edgePoint(to, boxW[t.to] ?? 80, boxH, control);
	const c = bendPoint(a, b, bend);
	// Labels go on the outside of the bend, clear of the line.
	const mid = alongCurve(a, c, b, 0.5);
	const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
	const nx = (a.y - b.y) / len;
	const ny = (b.x - a.x) / len;
	const side = bend >= 0 ? 1 : -1;
	return { kind: "curve", a, b, c, bend, labelAt: { x: mid.x + nx * 14 * side, y: mid.y + ny * 14 * side + 4 } };
}

/** The counter shown on a counting transition's label at `time`, e.g. "2/3". */
function counterAt(props: Props, i: number, time: number): number {
	const t = props.transitions[i];
	if (!t || t.count <= 1) return 0;
	const last = [...props.steps].reverse().find((s) => s.at <= time);
	if (!last) return 0;
	// Hold n/n on screen while the arrow it fired is still lit.
	if (last.fired === i && time < last.at + TIMES.flash) return t.count;
	return last.fired === undefined ? (last.counters[i] ?? 0) : 0;
}

function drawTransitions(frame: Frame, props: Props, centres: Point[], boxW: number[], boxH: number, narrow: boolean) {
	const { ctx, time, palette, height, width } = frame;
	for (const [i, t] of props.transitions.entries()) {
		const g = geometry(props, i, centres, boxW, boxH, height);
		if (!g) continue;

		// The arrow lights up for a moment each time this transition fires.
		const lit = Math.max(
			0,
			...props.steps.filter((s) => s.fired === i).map((s) => flash(time, s.at, TIMES.flash)),
		);
		const color = lit > 0.05 ? palette.marker : palette.rule;
		const w = 1.5 + lit * 1.5;

		if (g.kind === "loop" && g.loop) {
			const { centre, r, from, to } = g.loop;
			arc(ctx, centre, r, from, to, color, w);
			const tip = polar(centre, r, to);
			const before = polar(centre, r, to - 0.04);
			arrowHead(ctx, tip, Math.atan2(tip.y - before.y, tip.x - before.x), color);
		} else {
			curvedArrow(ctx, g.a, g.b, g.bend, color, w);
		}

		const count = counterAt(props, i, time);
		const name = t.count > 1 ? `${t.label} ${String(count)}/${String(t.count)}` : t.label;
		label(frame, name, g.labelAt.x, g.labelAt.y, {
			align: "center",
			mono: true,
			size: narrow ? 11 : 11,
			weight: lit > 0.05 || count > 0 ? 700 : 400,
			color: lit > 0.05 ? palette.marker : count > 0 ? palette.inkStrong : palette.inkMuted,
			maxX: width,
		});
	}
}

function drawStates(
	frame: Frame,
	props: Props,
	centres: Point[],
	boxW: number[],
	boxH: number,
	current: number,
	trip: Step | undefined,
) {
	const { ctx, time, palette } = frame;
	// During a trip the highlight fades off the old state and onto the new one.
	const leaving = trip?.fired === undefined ? undefined : props.transitions[trip.fired]?.from;
	const arriving = trip?.fired === undefined ? undefined : props.transitions[trip.fired]?.to;
	const t = trip ? progress(time, trip.at, TIMES.travel) : 0;

	for (const [i, s] of props.states.entries()) {
		const c = centres[i];
		const w = boxW[i] ?? 80;
		if (!c) continue;
		let on = i === current ? 1 : 0;
		if (trip && leaving !== arriving) {
			if (i === leaving) on = 1 - t;
			if (i === arriving) on = t;
		}
		box(ctx, c.x - w / 2, c.y - boxH / 2, w, boxH, 8, palette.paper, palette.rule, 1);
		if (on > 0) {
			withAlpha(ctx, on, () => {
				box(ctx, c.x - w / 2, c.y - boxH / 2, w, boxH, 8, palette.markerWash, palette.marker, 2);
			});
		}
		text(frame, s.label, c.x, c.y + 4.5, {
			align: "center",
			size: frame.width < 520 ? 12 : 13,
			weight: 700,
			color: on > 0.5 ? palette.inkStrong : palette.ink,
		});
	}
}

function drawToken(frame: Frame, props: Props, centres: Point[], boxW: number[], boxH: number, trip: Step | undefined) {
	const { ctx, time, palette, height } = frame;
	if (trip?.fired === undefined) return;
	const g = geometry(props, trip.fired, centres, boxW, boxH, height);
	if (!g) return;
	const t = ease.inOut(progress(time, trip.at, TIMES.travel));
	const p = g.kind === "loop" && g.loop ? polar(g.loop.centre, g.loop.r, g.loop.from + (g.loop.to - g.loop.from) * t) : alongCurve(g.a, g.c, g.b, t);
	dot(ctx, p.x, p.y, 5.5, palette.marker);
	ring(ctx, p.x, p.y, 8, palette.markerWash, 2);
}

function toneColor(palette: Palette, tone: EventTone): string {
	switch (tone) {
		case "ok":
			return palette.inkMuted;
		case "fail":
			return palette.danger;
		case "timer":
			return palette.warn;
	}
}

/**
 * The input stream: a time axis with one dot per input, hollow until time
 * reaches it. Inputs that fired a transition get a marker ring and, on wide
 * screens, the name of the state they led to; counted inputs show their count.
 */
function drawStrip(frame: Frame, props: Props, area: { x: number; y: number; w: number; h: number }, narrow: boolean) {
	const { ctx, time, palette } = frame;
	const left = area.x + 8;
	const right = area.x + area.w - 8;
	// Rows, top to bottom: legend, counts, the axis, then up to two rows of
	// destination labels.
	const axisY = area.y + 46;
	const x = scale(0, DURATION, left, right);

	line(ctx, area.x, area.y + 4, area.x + area.w, area.y + 4, palette.ruleFaint);

	// Legend: one dot per kind of input.
	let lx = left;
	let rowEnd = [-Infinity, -Infinity];
	for (const e of props.events) {
		dot(ctx, lx + 4, area.y + 17, 4, toneColor(palette, e.tone));
		text(frame, e.label, lx + 12, area.y + 21, { size: 11, color: palette.inkMuted });
		ctx.font = `400 11px ${palette.sans}`;
		lx += ctx.measureText(e.label).width + 28;
	}

	line(ctx, left, axisY, right, axisY, palette.rule);
	const head = x(Math.min(time, DURATION));
	line(ctx, left, axisY, head, axisY, palette.inkFaint, 2);

	for (const s of props.steps) {
		const ex = x(s.at);
		const kind = props.events.find((e) => e.id === s.event);
		const color = kind ? toneColor(palette, kind.tone) : palette.inkMuted;
		const seen = time >= s.at;
		if (!seen) {
			ring(ctx, ex, axisY, 4, palette.rule, 1.5);
			continue;
		}
		const pop = 1 + 0.6 * flash(time, s.at, 0.4);
		// An input that changed nothing is drawn faded: it arrived and was ignored.
		const counted = s.counters.some((c) => c > 0);
		withAlpha(ctx, s.fired === undefined && !counted ? 0.45 : 1, () => {
			dot(ctx, ex, axisY, 4 * pop, color);
		});

		if (s.fired !== undefined) {
			ring(ctx, ex, axisY, 8, palette.marker, 1.5);
			const to = props.transitions[s.fired]?.to;
			const name = to === undefined ? "" : (props.states[to]?.label ?? "");
			if (!narrow && name && props.transitions[s.fired]?.from !== to) {
				// A label that would run into the previous one drops a row.
				const value = `→ ${name}`;
				ctx.font = `400 11px ${palette.mono}`;
				const half = ctx.measureText(value).width / 2 + 6;
				const row = ex - half > (rowEnd[0] ?? -Infinity) ? 0 : 1;
				rowEnd = row === 0 ? [ex + half, rowEnd[1] ?? -Infinity] : [rowEnd[0] ?? -Infinity, ex + half];
				line(ctx, ex, axisY + 9, ex, axisY + 13 + row * 18, palette.marker, 1);
				text(frame, value, ex, axisY + 26 + row * 18, { align: "center", mono: true, size: 11, color: palette.marker });
			}
		} else {
			const i = s.counters.findIndex((c) => c > 0);
			const t = props.transitions[i];
			if (t && t.count > 1) {
				const n = s.counters[i] ?? 0;
				text(frame, narrow ? String(n) : `${String(n)}/${String(t.count)}`, ex, axisY - 13, {
					align: "center",
					mono: true,
					size: 11,
					color: palette.inkMuted,
				});
			}
		}
	}

	// The playhead.
	if (time < DURATION) {
		line(ctx, head, axisY - 7, head, axisY + 7, palette.inkStrong, 1.5);
	}
}
