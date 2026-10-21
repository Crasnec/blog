/**
 * sort — bars being sorted by a real algorithm, one operation at a time.
 *
 * `decode` runs the chosen algorithm on the input and records every
 * comparison and every swap (or, for merge sort, every move) it actually
 * makes. `draw` replays that trace: the pair being compared lights up in the
 * marker colour, swapped bars slide past each other, and bars that have
 * reached their final place turn solid. The counters are counts of the trace,
 * so two figures with the same values and the same `step` finish at moments
 * that are honestly proportional to the work each algorithm did.
 *
 *   <Figure kind="sort" props={{ algorithm: "quick", values: [8, -2, 5, 0], step: 0.05 }} />
 *
 * Props:
 *   algorithm  "bubble" | "insertion" | "quick" | "merge" (required)
 *   values     the numbers to sort (2–40 finite signed numbers, magnitude <= 1e12); else generated
 *   count      how many values to generate when `values` is absent (default 16)
 *   seed       seed for generated values (default 3)
 *   step       seconds per comparison; swaps and moves take twice as long.
 *              Give two figures the same `step` to compare their speed.
 *              Default: whatever fits the trace into the figure.
 *   title      label shown top left (default: the algorithm's Korean name)
 */

import {
	canvasRect,
	defineFigure,
	ease,
	formatNumber,
	inset,
	label,
	lerp,
	maybe,
	num,
	nums,
	obj,
	progress,
	str,
	text,
	withAlpha,
} from "../kit.ts";

import { numberSamples } from "../generators.ts";
import { traceSort as trace, type Algorithm, type Op } from "../models/sort.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
	/** Bars fade in. */
	appear: 0.6,
	/** The first operation starts. */
	start: 0.8,
	/** Time kept free after the last operation for the totals to show. */
	tail: 1.2,
} as const;

const DURATION = 10;
const AVAILABLE = DURATION - TIMES.start - TIMES.tail;

/** Relative length of each kind of operation; a move needs time to be seen. */
const WEIGHT = { compare: 1, swap: 2, move: 2 } as const;


const ALGORITHMS: readonly Algorithm[] = ["bubble", "insertion", "quick", "merge"];
const NAMES: Record<Algorithm, string> = {
	bubble: "Bubble sort",
	insertion: "Insertion sort",
	quick: "Quicksort",
	merge: "Merge sort",
};

/* — 2. the trace ——————————————————————————————————————————————————— */

/*
 * One operation the algorithm really performed. Slots are positions in the
 * row; bars keep an identity (`id`) so the replay can slide the same bar from
 * one slot to another.
 */

/** An operation with everything the replay needs, worked out in `decode`. */
interface Step {
	op: Op;
	start: number;
	length: number;
	/** Slot of every bar id just before this step. */
	slots: number[];
	/** Bar ids already in their final place before this step. */
	settled: boolean[];
	/** Quick sort's current pivot (a bar id), or -1. */
	pivot: number;
	/** Running totals before this step. */
	compares: number;
	writes: number;
}

/**
 * Runs `algorithm` on `values`, recording each comparison, swap and move,
 * and when each bar reaches its final slot.
 */

/* — 3. props ————————————————————————————————————————————————————————— */

interface Props {
	values: number[];
	title: string;
	writeWord: string;
	steps: Step[];
	/** State after the last operation. */
	final: { slots: number[]; settled: boolean[] };
	end: number;
	totals: { compares: number; writes: number };
}

export default defineFigure<Props>({
	duration: DURATION,
	height: 250,

	decode(raw) {
		const p = obj(raw, "props");
		const algorithm = str(p.algorithm, "props.algorithm");
		const algo = ALGORITHMS.find((a) => a === algorithm);
		if (!algo) throw new Error(`props.algorithm must be one of ${ALGORITHMS.join(", ")}`);

		let values: number[];
		if (p.values !== undefined) {
			values = nums(p.values, "props.values");
		} else {
			const count = maybe(p.count, "props.count", num) ?? 16;
			if (!Number.isInteger(count) || count < 2 || count > 40) {
				throw new Error("props.count must be a whole number from 2 to 40");
			}
			values = numberSamples(count, { seed: maybe(p.seed, "props.seed", num) ?? 3, min: 1, max: 99, integer: true });
		}
		if (values.length < 2 || values.length > 40 || values.some((x) => Math.abs(x) > 1e12)) {
			throw new Error("props.values must be 2 to 40 finite numbers with magnitude at most 1e12");
		}

		const { ops, final } = trace(algo, values);
		const weight = (op: Op) => WEIGHT[op.kind];
		const units = ops.reduce((s, o) => s + weight(o.op), 0);
		const fitted = Math.min(AVAILABLE / Math.max(1, units), 0.25);
		const step = maybe(p.step, "props.step", num) ?? fitted;
		if (step <= 0) throw new Error("props.step must be positive");
		if (units * step > AVAILABLE + 1e-9) {
			throw new Error(
				`props.step ${String(step)}s makes this sort take ${(units * step).toFixed(1)}s, ` +
					`but only ${AVAILABLE.toFixed(1)}s fit; use a smaller step or fewer values`,
			);
		}

		let at = TIMES.start;
		let compares = 0;
		let writes = 0;
		const steps: Step[] = ops.map((o) => {
			const s: Step = { ...o, start: at, length: weight(o.op) * step, compares, writes };
			at += s.length;
			if (o.op.kind === "compare") compares++;
			else writes++;
			return s;
		});

		return {
			values,
			title: maybe(p.title, "props.title", str) ?? NAMES[algo],
			writeWord: algo === "merge" ? "moves" : "swaps",
			steps,
			final,
			end: at,
			totals: { compares, writes },
		};
	},

	draw(frame, props) {
		const { ctx, width, time, palette } = frame;
		const n = props.values.length;
		const narrow = width < 520;

		/* where in the trace are we? the last step that has started */
		let k = -1;
		for (let lo = 0, hi = props.steps.length - 1; lo <= hi; ) {
			const mid = (lo + hi) >> 1;
			if ((props.steps[mid]?.start ?? Infinity) <= time) {
				k = mid;
				lo = mid + 1;
			} else {
				hi = mid - 1;
			}
		}
		const cur = k >= 0 ? props.steps[k] : undefined;
		const running = cur !== undefined && time < cur.start + cur.length;
		// Before the first step, during a step, or after the last one.
		const base = cur ?? props.steps[0];
		const done = time >= props.end;
		const slots = done || (!running && k === props.steps.length - 1) ? props.final.slots : (base?.slots ?? props.final.slots);
		const settled = done ? props.final.settled : (base?.settled ?? props.final.settled);
		const t = running ? ease.inOut(progress(time, cur.start, cur.length)) : 1;

		/*
		 * Where each bar is drawn, as a fractional slot. Outside a swap or move
		 * every bar sits on its slot from the step's snapshot; during one, the
		 * bars involved slide.
		 */
		const pos = slots.map((s) => s);
		const active = new Set<number>();
		/*
		 * How far through a crossing the moving bars are: 0 at rest, 1 at the
		 * middle of a swap or move. Moving bars narrow as they cross, so two
		 * bars passing each other stay visible side by side.
		 */
		let crossing = 0;
		if (cur && running && !done) {
			const idAt = (slot: number) => slots.indexOf(slot);
			const op = cur.op;
			if (op.kind === "compare") {
				active.add(idAt(op.i));
				active.add(idAt(op.j));
			} else if (op.kind === "swap") {
				const a = idAt(op.i);
				const b = idAt(op.j);
				crossing = Math.sin(Math.PI * t);
				// Each bar leads a little in its own direction, so the two pass
				// each other early and briefly instead of sitting on one spot.
				const lead = 0.3 * crossing * Math.sign(op.j - op.i);
				pos[a] = lerp(op.i, op.j, t) + lead;
				pos[b] = lerp(op.j, op.i, t) - lead;
				active.add(a);
				active.add(b);
			} else {
				const m = idAt(op.from);
				for (const [id, s] of slots.entries()) {
					if (s >= op.to && s < op.from) pos[id] = s + t;
				}
				pos[m] = lerp(op.from, op.to, t);
				active.add(m);
				crossing = Math.sin(Math.PI * t);
			}
		}
		// A finished compare or swap leaves the next state; only snap when idle.
		if (cur && !running && !done) {
			const next = props.steps[k + 1];
			if (next) for (const [id, s] of next.slots.entries()) pos[id] = s;
		}

		/* layout */
		const area = canvasRect(frame);
		const header = narrow ? 42 : 22;
		ctx.font = `400 11px ${palette.mono}`;
		const widest = Math.max(...props.values.map((value) => ctx.measureText(formatNumber(value)).width));
		const showValues = width / n >= Math.max(18, widest + 4);
		const bars = inset({ x: area.x, y: area.y + header + 8, w: area.w, h: area.h - header - 8 - (showValues ? 18 : 4) }, [0, 2]);
		const slotW = bars.w / n;
		const gap = Math.min(4, slotW * 0.18);
		const min = Math.min(0, ...props.values);
		const max = Math.max(0, ...props.values) || (min === 0 ? 1 : 0);
		const yOf = (value: number) => bars.y + bars.h - ((value - min) / (max - min)) * bars.h;
		const baseline = yOf(0);
		const xOf = (slot: number) => bars.x + slot * slotW + gap / 2;

		withAlpha(ctx, ease.out(progress(time, 0, TIMES.appear)), () => {
			/* layer 1: header — name on the left, counters on the right */
			text(frame, props.title, area.x, area.y + 14, { size: 13, weight: 700, color: palette.inkStrong });
			const compares = done ? props.totals.compares : (cur?.compares ?? 0) + (cur?.op.kind === "compare" ? 1 : 0);
			const writes = done ? props.totals.writes : (cur?.writes ?? 0) + (cur && cur.op.kind !== "compare" ? 1 : 0);
			const summary = `Comparisons ${String(compares)} · ${props.writeWord} ${String(writes)}`;
			label(frame, summary, area.x + area.w, area.y + (narrow ? 34 : 14), {
				size: narrow ? 11 : 12,
				weight: done ? 700 : 500,
				mono: true,
				color: done ? palette.marker : palette.inkMuted,
				maxX: area.x + area.w,
			});

			/* layer 2: baseline */
			ctx.fillStyle = palette.rule;
			ctx.fillRect(bars.x, baseline, bars.w, 1);

			/* layer 3: bars, inactive first so the active pair is on top */
			// Inactive bars first, then the active ones, the shorter of them last,
			// so a short bar crossing a tall one is drawn in front of it.
			const ids = props.values
				.map((_, id) => id)
				.sort(
					(a, b) =>
						Number(active.has(a)) - Number(active.has(b)) ||
						(active.has(a) ? (props.values[b] ?? 0) - (props.values[a] ?? 0) : 0),
				);
			for (const id of ids) {
				const value = props.values[id] ?? 0;
				const h = Math.max(2, Math.abs(yOf(value) - baseline));
				const barTop = value >= 0 ? baseline - h : baseline;
				const full = slotW - gap;
				const w = active.has(id) ? full * (1 - 0.45 * crossing) : full;
				const x = xOf(pos[id] ?? 0) + (full - w) / 2;
				const isPivot = !done && base?.pivot === id;
				// Slightly see-through while crossing, so the bar behind still shows.
				const groupAlpha = ctx.globalAlpha;
				if (active.has(id) && crossing > 0.2) ctx.globalAlpha = groupAlpha * 0.85;
				ctx.fillStyle = active.has(id)
					? palette.marker
					: settled[id] === true || done
						? palette.inkStrong
						: palette.inkFaint;
				ctx.fillRect(x, barTop, w, h);
				ctx.globalAlpha = groupAlpha;
				if (isPivot) {
					ctx.strokeStyle = palette.warn;
					ctx.lineWidth = 2;
					ctx.strokeRect(x - 1, barTop - 1, w + 2, h + 2);
				}
				// A moving bar's number would print over its partner's mid-swap.
				if (showValues && !(active.has(id) && crossing > 0.35)) {
					text(frame, formatNumber(value), x + w / 2, bars.y + bars.h + 14, {
						align: "center",
						mono: true,
						size: 11,
						color: active.has(id) ? palette.marker : palette.inkFaint,
					});
				}
			}

			/* layer 4: name the pivot once, above its bar */
			const pivot = !done ? (base?.pivot ?? -1) : -1;
			if (pivot >= 0) {
				const value = props.values[pivot] ?? 0;
				const x = xOf(pos[pivot] ?? 0) + (slotW - gap) / 2;
				const top = Math.min(baseline, yOf(value));
				text(frame, "Pivot", x, Math.max(bars.y + 10, top - 6), { align: "center", size: 11, weight: 600, color: palette.warn });
			}
		});
	},
});
