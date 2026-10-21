/**
 * queue — reusable comparison of FCFS queues.
 *
 * Props: servers (2–4), arrivals (1–14 ordered nonnegative times), services
 * (matching positive durations), policies?: {policy: "per-server"|"shared",
 * label: string}[] (1–2 unique policies), unit?, entryLabel?, doneLabel?,
 * waitingLabel?, highlight?: {index,label}, warnAfter?, dangerAfter?.
 * Both policies use the exact same workload. The entire trace is fitted to
 * the animation; reported waits remain in the input's original time unit.
 */
import {
	along, arr, bar, box, canvasRect, center, defineFigure, dot, ease, fittedText, heat,
	line, maybe, mean, num, nums, obj, progress, ring, rows, str, text, withAlpha,
	type Frame, type Point, type Rect,
} from "../kit.ts";
import { simulateQueue, type QueuePolicy, type Visit } from "../models/queue.ts";

const TIMES = { appear: 0.6, first: 0.8, verdict: 7.6, leave: 0.5, walk: 0.45, step: 0.25, duration: 8.6 } as const;

/** Serializable author input, also usable from a post-specific TSX component. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- A closed object alias is assignable to JsonObject without an open index signature.
export type QueueInput = {
	servers: number;
	arrivals: number[];
	services: number[];
	policies?: { policy: QueuePolicy; label: string }[];
	unit?: string;
	entryLabel?: string;
	doneLabel?: string;
	waitingLabel?: string;
	highlight?: { index: number; label: string };
	warnAfter?: number;
	dangerAfter?: number;
};

interface Model {
	servers: number;
	count: number;
	lanes: { policy: QueuePolicy; label: string; visits: Visit[]; average: number; worst: number }[];
	scale: number;
	unit: string;
	entryLabel: string;
	doneLabel: string;
	waitingLabel: string;
	highlight: { index: number; label: string } | undefined;
	warnAfter: number;
	dangerAfter: number;
}

const wait = (v: Visit) => v.start - v.arrive;

export default defineFigure<Model>({
	duration: TIMES.duration,
	height: 380,
	heightFor: (_width, model) => model.lanes.length * 190,
	decode(raw) {
		const p = obj(raw, "props");
		const servers = num(p.servers, "props.servers");
		if (!Number.isInteger(servers) || servers < 2 || servers > 4) throw new Error("props.servers must be an integer from 2 to 4");
		const arrivals = nums(p.arrivals, "props.arrivals");
		const services = nums(p.services, "props.services");
		if (arrivals.length < 1 || arrivals.length > 14 || arrivals.some((at, i) => at < 0 || at > 1e6 || at < (arrivals[i - 1] ?? 0))) throw new Error("props.arrivals needs 1–14 ordered times from 0 to 1e6");
		if (services.length !== arrivals.length || services.some((duration) => duration < 1e-6 || duration > 1e6)) throw new Error("props.services needs one duration from 1e-6 to 1e6 per arrival");
		const policies = arr(p.policies ?? [{ policy: "per-server", label: "Dedicated queues" }, { policy: "shared", label: "Shared queue" }], "props.policies").map((v, i): { policy: QueuePolicy; label: string } => {
			const path = `props.policies[${String(i)}]`;
			const policy = obj(v, path);
			const name = str(policy.policy, `${path}.policy`);
			if (name !== "per-server" && name !== "shared") throw new Error(`${path}.policy must be per-server or shared`);
			return { policy: name, label: str(policy.label, `${path}.label`) };
		});
		if (policies.length < 1 || policies.length > 2 || new Set(policies.map((p) => p.policy)).size !== policies.length) throw new Error("props.policies needs 1–2 unique policies");
		const highlight = maybe(p.highlight, "props.highlight", (v, path) => {
			const h = obj(v, path);
			const index = num(h.index, `${path}.index`);
			if (!Number.isInteger(index) || index < 0 || index >= arrivals.length) throw new Error(`${path}.index must identify an arrival`);
			return { index, label: str(h.label, `${path}.label`) };
		});
		const warnAfter = maybe(p.warnAfter, "props.warnAfter", num) ?? 1.2;
		const dangerAfter = maybe(p.dangerAfter, "props.dangerAfter", num) ?? 2.4;
		if (warnAfter <= 0 || dangerAfter <= warnAfter) throw new Error("props.dangerAfter must exceed positive props.warnAfter");
		const lanes = policies.map((policy) => {
			const visits = simulateQueue(policy.policy, arrivals, services, servers);
			return { ...policy, visits, average: mean(visits.map(wait)), worst: Math.max(...visits.map(wait)) };
		});
		const last = Math.max(...lanes.flatMap((lane) => lane.visits.map((v) => v.end)));
		return {
			servers, count: arrivals.length, lanes, scale: (TIMES.verdict - TIMES.leave - TIMES.first) / last,
			highlight, warnAfter, dangerAfter,
			unit: maybe(p.unit, "props.unit", str) ?? "s",
			entryLabel: maybe(p.entryLabel, "props.entryLabel", str) ?? "Arrival",
			doneLabel: maybe(p.doneLabel, "props.doneLabel", str) ?? "Done",
			waitingLabel: maybe(p.waitingLabel, "props.waitingLabel", str) ?? "Wait",
		};
	},
	draw(frame, model) {
		const panels = rows(canvasRect(frame), model.lanes.length, 20);
		const best = Math.min(...model.lanes.map((lane) => lane.average));
		withAlpha(frame.ctx, ease.out(progress(frame.time, 0, TIMES.appear)), () => {
			for (const [i, lane] of model.lanes.entries()) {
				const panel = panels[i];
				if (!panel) continue;
				drawLane(frame, model, lane, panel, lane.average === best);
				if (i < panels.length - 1) line(frame.ctx, 0, panel.y + panel.h + 10, frame.width, panel.y + panel.h + 10, frame.palette.ruleFaint);
			}
		});
	},
});

function drawLane(frame: Frame, model: Model, lane: Model["lanes"][number], panel: Rect, better: boolean): void {
	const { ctx, width, time, palette } = frame;
	const narrow = width < 520;
	const body = { x: panel.x, y: panel.y + 46, w: panel.w, h: panel.h - 50 };
	const doneCols = narrow ? 4 : 6;
	const doneStep = narrow ? 10 : 16;
	const doneX = width - doneCols * doneStep;
	const serverW = narrow ? 52 : 88;
	const servers = rows({ x: doneX - 12 - serverW, y: body.y, w: serverW, h: body.h }, model.servers, 5);
	const serverAt = (s: number): Point => {
		const server = servers[s] ?? body;
		return { x: server.x + 11, y: center(server).y };
	};
	const headX = (servers[0]?.x ?? 0) - 16;
	const spacing = narrow ? 10 : 17;
	const slots = Math.max(1, Math.floor((headX - body.x - 20) / spacing));
	const gridRows = Math.ceil(model.count / slots);
	const slot = (v: Visit, rank: number): Point => {
		const at = (k: number) => ({ x: headX - (k % slots) * spacing, y: (lane.policy === "shared" ? center(body).y : serverAt(v.server).y) + (Math.floor(k / slots) - (gridRows - 1) / 2) * 9 });
		return along(at(Math.floor(rank)), at(Math.ceil(rank)), rank % 1);
	};
	const arriveAt = (v: Visit) => TIMES.first + v.arrive * model.scale;
	const startAt = (v: Visit) => TIMES.first + v.start * model.scale;
	const endAt = (v: Visit) => TIMES.first + v.end * model.scale;
	const stepFor = (v: Visit) => Math.min(TIMES.step, (v.end - v.start) * model.scale / 3);
	const doneAt = (i: number): Point => ({ x: doneX + (i % doneCols) * doneStep + 4, y: body.y + 24 + Math.floor(i / doneCols) * doneStep });
	const door = { x: body.x + 6, y: center(body).y };
	fittedText(frame, lane.label, panel.x, panel.y + 13, panel.w, palette.inkStrong);
	const verdict = progress(time, TIMES.verdict, 0.5);
	const summary = verdict > 0 ? `Mean ${lane.average.toFixed(1)}${model.unit} · max ${lane.worst.toFixed(1)}${model.unit}` : `${model.waitingLabel} ${String(lane.visits.filter((v) => time >= arriveAt(v) && time < startAt(v)).length)}`;
	fittedText(frame, summary, panel.x, panel.y + 33, panel.w, verdict > 0 ? better ? palette.marker : palette.danger : palette.inkFaint);
	for (const [i, server] of servers.entries()) {
		const active = lane.visits.find((v) => v.server === i && time >= startAt(v) && time < endAt(v));
		box(ctx, server.x, server.y, server.w, server.h, 5, palette.paper, palette.rule);
		text(frame, String(i + 1), server.x + server.w - 6, server.y + 12, { align: "right", mono: true, size: 11, color: palette.inkFaint });
		bar(ctx, { x: server.x + 20, y: center(server).y + 3, w: server.w - 28, h: 4 }, active ? progress(time, startAt(active), endAt(active) - startAt(active)) : 0, palette.inkMuted, palette.ruleFaint);
	}
	fittedText(frame, model.doneLabel, doneX, body.y + 10, width - doneX, palette.inkFaint);
	fittedText(frame, model.entryLabel, door.x, body.y + 10, headX - door.x - 8, palette.inkFaint);
	for (const [i, v] of lane.visits.entries()) {
		const arrive = arriveAt(v), start = startAt(v), end = endAt(v), step = stepFor(v);
		if (time < arrive - TIMES.walk) continue;
		const rank = v.ahead.reduce((k, j) => {
			const ahead = lane.visits[j];
			return k + (ahead ? 1 - progress(time, startAt(ahead), stepFor(ahead)) : 0);
		}, 0);
		const waiting = slot(v, rank);
		const server = serverAt(v.server);
		let at: Point;
		if (time < arrive) at = along(door, waiting, ease.out(progress(time, arrive - TIMES.walk, TIMES.walk)));
		else if (time < start) at = waiting;
		else if (time < start + step) at = along(slot(v, 0), server, ease.inOut(progress(time, start, step)));
		else if (time < end) at = server;
		else at = along(server, doneAt(i), ease.inOut(progress(time, end, TIMES.leave)));
		const waited = Math.max(0, Math.min((time - TIMES.first) / model.scale, v.start) - v.arrive);
		dot(ctx, at.x, at.y, 3.5, heat(palette, waited, model.warnAfter, model.dangerAfter));
		if (i === model.highlight?.index && time < end) ring(ctx, at.x, at.y, 6, palette.warn, 1.5);
	}
	const highlighted = model.highlight && lane.visits[model.highlight.index];
	if (highlighted && model.highlight && time >= startAt(highlighted) && time < endAt(highlighted)) {
		fittedText(frame, model.highlight.label, panel.x, panel.y + panel.h - 1, panel.w, palette.warn);
	}
}
