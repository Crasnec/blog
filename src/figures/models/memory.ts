/** Reusable deterministic model, independent of canvas rendering and post data. */
export type Policy = "first-fit" | "best-fit" | "worst-fit" | "next-fit";

export type Request = { op: "alloc"; id: string; size: number } | { op: "free"; id: string };

export interface Block {
	id: string;
	start: number;
	size: number;
}

export interface Hole {
	start: number;
	size: number;
}

/** What one request did, and the heap right after it. */
export interface Step {
	request: Request;
	/** Alloc: the hole the policy chose. */
	hole: Hole | undefined;
	/** Alloc: where the block went. Free: the block that was released. */
	block: Block | undefined;
	/** Alloc that no hole could hold. */
	failed: { needed: number; free: number; largest: number } | undefined;
	after: Block[];
}

export function holesOf(blocks: Block[], heap: number): Hole[] {
	const used = [...blocks].sort((a, b) => a.start - b.start);
	const holes: Hole[] = [];
	let at = 0;
	for (const b of used) {
		if (b.start > at) holes.push({ start: at, size: b.start - at });
		at = Math.max(at, b.start + b.size);
	}
	if (at < heap) holes.push({ start: at, size: heap - at });
	return holes;
}

function choose(policy: Policy, holes: Hole[], size: number, cursor: number): Hole | undefined {
	const fits = holes.filter((h) => h.size >= size);
	switch (policy) {
		case "first-fit":
			return fits[0];
		case "best-fit":
			return fits.reduce<Hole | undefined>((best, h) => (!best || h.size < best.size ? h : best), undefined);
		case "worst-fit":
			return fits.reduce<Hole | undefined>((best, h) => (!best || h.size > best.size ? h : best), undefined);
		case "next-fit":
			// A free may merge a hole across the cursor. Search its remaining
			// tail first, then later holes, before wrapping to the start.
			for (const h of holes) {
				const start = Math.max(h.start, cursor);
				const available = h.start + h.size - start;
				if (available >= size) return { start, size: available };
			}
			return fits[0];
	}
}

/*
 * Runs once, in `decode`. Everything `draw` shows — which hole, where the
 * block lands, whether it fails, the totals — comes from here.
 */
export function simulate(policy: Policy, heap: number, requests: Request[]): Step[] {
	let blocks: Block[] = [];
	const failedIds = new Set<string>();
	const freed = new Set<string>();
	let cursor = 0;
	const steps: Step[] = [];

	for (const [i, request] of requests.entries()) {
		const path = `props.requests[${String(i)}]`;
		if (request.op === "alloc") {
			if (blocks.some((b) => b.id === request.id) || failedIds.has(request.id)) {
				throw new Error(`${path}: "${request.id}" is already allocated`);
			}
			if (request.size > heap) throw new Error(`${path}: size ${String(request.size)} is larger than the heap`);
			freed.delete(request.id);
			const holes = holesOf(blocks, heap);
			const hole = choose(policy, holes, request.size, cursor);
			if (!hole) {
				failedIds.add(request.id);
				const free = holes.reduce((s, h) => s + h.size, 0);
				const largest = Math.max(0, ...holes.map((h) => h.size));
				steps.push({ request, hole: undefined, block: undefined, failed: { needed: request.size, free, largest }, after: blocks });
				continue;
			}
			const block = { id: request.id, start: hole.start, size: request.size };
			blocks = [...blocks, block];
			cursor = block.start + block.size;
			steps.push({ request, hole, block, failed: undefined, after: blocks });
		} else {
			if (failedIds.delete(request.id)) {
				steps.push({ request, hole: undefined, block: undefined, failed: undefined, after: blocks });
				continue;
			}
			const block = blocks.find((b) => b.id === request.id);
			if (!block) {
				throw new Error(
					freed.has(request.id)
						? `${path}: "${request.id}" is freed twice`
						: `${path}: "${request.id}" was never allocated`,
				);
			}
			freed.add(request.id);
			blocks = blocks.filter((b) => b !== block);
			steps.push({ request, hole: undefined, block, failed: undefined, after: blocks });
		}
	}
	return steps;
}
