/**
 * flow — boxes joined by arrows, with requests travelling along them.
 *
 * For "where does a request go": a load balancer fanning out, a cache in front
 * of a database, a queue between two services. It loops, because the point is
 * a steady state. An edge with `drop` loses that share of its packets at the
 * far end, which is how a timeout or a rejected request is shown: the packet
 * greys out on the way and bursts in the danger colour where it fails.
 *
 * Positions are fractions of the canvas, so the same props work at any width:
 * `x: 0` is the left edge, `x: 1` the right, and `y` likewise top to bottom.
 *
 *   <Figure kind="flow" props={{
 *     nodes: [
 *       { id: "lb", label: "LB", x: 0.1, y: 0.5 },
 *       { id: "api", label: "API", x: 0.5, y: 0.5 },
 *       { id: "db", label: "DB", x: 0.9, y: 0.5, tone: "warn" },
 *     ],
 *     edges: [
 *       { from: "lb", to: "api", rate: 3 },
 *       { from: "api", to: "db", rate: 3, drop: 0.3, label: "timeout" },
 *     ],
 *   }} />
 */

import {
	along,
	arr,
	arrow,
	box,
	burst,
	defineFigure,
	dot,
	ease,
	label,
	maybe,
	num,
	obj,
	progress,
	random,
	str,
	text,
	tone,
	toneColor,
	type Point,
	type Tone,
} from "../kit.ts";

interface Node {
	id: string;
	label: string;
	sub: string | undefined;
	x: number;
	y: number;
	tone: Tone;
}

interface Edge {
	from: Node;
	to: Node;
	/** Packets per second. */
	rate: number;
	drop: number;
	label: string | undefined;
	tone: Tone;
}

interface Props {
	nodes: Node[];
	edges: Edge[];
}

/** Pixels per second a packet travels, and the least time it takes on any edge. */
const SPEED = 140;
const MIN_TRAVEL = 0.7;
const PACKET_R = 4;
const NODE_H = 40;

export default defineFigure<Props>({
	duration: 8,
	loop: true,
	height: 220,

	decode(raw) {
		const p = obj(raw, "props");
		const nodes = arr(p.nodes, "props.nodes").map((n, i) => {
			const path = `props.nodes[${String(i)}]`;
			const o = obj(n, path);
			return {
				id: str(o.id, `${path}.id`),
				label: str(o.label, `${path}.label`),
				sub: maybe(o.sub, `${path}.sub`, str),
				x: num(o.x, `${path}.x`),
				y: num(o.y, `${path}.y`),
				tone: tone(o.tone, `${path}.tone`, "ink"),
			};
		});
		const byId = new Map(nodes.map((n) => [n.id, n]));
		const find = (id: string, path: string) => {
			const node = byId.get(id);
			if (!node) {
				throw new Error(`${path} is "${id}", which is not one of the node ids: ${[...byId.keys()].join(", ")}`);
			}
			return node;
		};

		return {
			nodes,
			edges: arr(p.edges ?? [], "props.edges").map((e, i) => {
				const path = `props.edges[${String(i)}]`;
				const o = obj(e, path);
				return {
					from: find(str(o.from, `${path}.from`), `${path}.from`),
					to: find(str(o.to, `${path}.to`), `${path}.to`),
					rate: maybe(o.rate, `${path}.rate`, num) ?? 1.5,
					drop: maybe(o.drop, `${path}.drop`, num) ?? 0,
					label: maybe(o.label, `${path}.label`, str),
					tone: tone(o.tone, `${path}.tone`, "marker"),
				};
			}),
		};
	},

	draw(frame, props) {
		const { ctx, width, height, time, palette } = frame;
		const narrow = width < 520;
		const padX = narrow ? 30 : 56;
		const padY = NODE_H / 2 + 8;
		ctx.font = `600 13px ${palette.sans}`;
		const widthOf = (n: Node) => Math.max(narrow ? 48 : 64, ctx.measureText(n.label).width + (narrow ? 18 : 28));

		// Centres are clamped so a box at x: 0 or x: 1 still fits on the canvas.
		const at = (n: Node): Point => {
			const half = widthOf(n) / 2 + 1;
			const x = padX + n.x * (width - padX * 2);
			return {
				x: Math.min(width - half, Math.max(half, x)),
				y: padY + n.y * (height - padY * 2),
			};
		};

		const appear = ease.out(progress(time, 0, 0.6));

		// Edges stop at the box borders so the arrowheads are visible.
		const segments = props.edges.map((e) => {
			const a = at(e.from);
			const b = at(e.to);
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy) || 1;
			const trim = (n: Node) => {
				const hw = widthOf(n) / 2;
				const hh = NODE_H / 2;
				return Math.min(Math.abs(dx) > 0 ? hw / (Math.abs(dx) / len) : Infinity, Math.abs(dy) > 0 ? hh / (Math.abs(dy) / len) : Infinity) + 4;
			};
			const ta = trim(e.from);
			const tb = trim(e.to);
			const start = { x: a.x + (dx / len) * ta, y: a.y + (dy / len) * ta };
			const end = { x: b.x - (dx / len) * tb, y: b.y - (dy / len) * tb };
			return { edge: e, start, end, length: Math.max(1, len - ta - tb) };
		});

		ctx.globalAlpha = appear;
		for (const { start, end } of segments) {
			arrow(ctx, start, end, palette.rule, 1.5);
		}
		ctx.globalAlpha = 1;

		// Packets: the k-th one on an edge leaves at k / rate seconds.
		segments.forEach(({ edge, start, end, length }, ei) => {
			const travel = Math.max(MIN_TRAVEL, length / SPEED);
			const rand = random(ei * 7919 + 13);
			const color = toneColor(palette, edge.tone);
			const count = Math.ceil(time * edge.rate) + 1;
			for (let k = 0; k < count; k++) {
				const jitter = rand() * 0.35;
				const leave = 0.6 + (k + jitter) / edge.rate;
				const dropped = rand() < edge.drop;
				const t = (time - leave) / travel;
				if (t < 0) continue;

				if (t <= 1) {
					const pos = along(start, end, t);
					dot(ctx, pos.x, pos.y, PACKET_R, dropped && t > 0.6 ? palette.inkFaint : color);
					continue;
				}

				// A dropped packet bursts at the far end instead of arriving.
				const after = (t - 1) * travel;
				if (dropped) burst(ctx, end.x, end.y, after / 0.8, palette.danger);
			}
		});

		// Edge labels sit beside their edge rather than on it, pushed out along
		// the normal just far enough that the plate clears the line and the
		// packets riding it. Above the edge, or right of a vertical one.
		ctx.globalAlpha = appear;
		for (const { edge, start, end, length } of segments) {
			if (!edge.label) continue;
			ctx.font = `400 11px ${palette.mono}`;
			const w = ctx.measureText(edge.label).width + 8;
			// A label longer than its edge would float free of it; the caption has to carry it.
			if (w + 16 > length) continue;

			const dx = (end.x - start.x) / length;
			const dy = (end.y - start.y) / length;
			let nx = -dy;
			let ny = dx;
			if (ny > 0 || (Math.abs(ny) < 1e-6 && nx < 0)) {
				nx = -nx;
				ny = -ny;
			}
			const half = { w: w / 2, h: 17 / 2 };
			const clear = Math.abs(nx) * half.w + Math.abs(ny) * half.h + PACKET_R + 3;
			const mid = along(start, end, 0.5);
			const cx = mid.x + nx * clear;
			const cy = mid.y + ny * clear;
			// `label` draws its plate from 11px above the baseline to 6px below.
			label(frame, edge.label, cx, cy + 2.5, { align: "center", mono: true, size: 11, color: palette.inkMuted });
		}

		// Nodes last, so packets slide under them.
		for (const n of props.nodes) {
			const c = at(n);
			const w = widthOf(n);
			const accent = n.tone === "ink" ? palette.rule : toneColor(palette, n.tone);
			box(ctx, c.x - w / 2, c.y - NODE_H / 2, w, NODE_H, 6, palette.paper, accent, n.tone === "ink" ? 1 : 2);
			text(frame, n.label, c.x, c.y + (n.sub ? -1 : 4.5), { align: "center", size: 13, weight: 600, color: palette.inkStrong });
			if (n.sub) {
				text(frame, n.sub, c.x, c.y + 13, { align: "center", mono: true, size: 10, color: palette.inkFaint });
			}
		}
		ctx.globalAlpha = 1;
	},
});
