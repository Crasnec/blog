/** Reusable deterministic model, independent of canvas rendering and post data. */
export type Algorithm = "bubble" | "insertion" | "quick" | "merge";

export type Op =
	| { kind: "compare"; i: number; j: number }
	| { kind: "swap"; i: number; j: number }
	/** Take the bar at slot `from` and put it at slot `to` (< from), shifting the rest right. */
	| { kind: "move"; from: number; to: number };


export function traceSort(algorithm: Algorithm, values: number[]) {
	const n = values.length;
	/** `order[slot]` is the id of the bar in that slot; ids index `values`. */
	const order = values.map((_, id) => id);
	const v = (slot: number) => values[order[slot] ?? 0] ?? 0;
	const settled = values.map(() => false);
	let pivot = -1;

	const ops: { op: Op; settled: boolean[]; pivot: number; slots: number[] }[] = [];
	const slotsNow = () => {
		const slots = values.map(() => 0);
		for (const [slot, id] of order.entries()) slots[id] = slot;
		return slots;
	};
	const record = (op: Op) => {
		ops.push({ op, settled: [...settled], pivot, slots: slotsNow() });
	};
	const settle = (slot: number) => {
		const id = order[slot];
		if (id !== undefined) settled[id] = true;
	};
	const compare = (i: number, j: number) => {
		record({ kind: "compare", i, j });
	};
	const swap = (i: number, j: number) => {
		record({ kind: "swap", i, j });
		const a = order[i] ?? 0;
		order[i] = order[j] ?? 0;
		order[j] = a;
	};
	const move = (from: number, to: number) => {
		record({ kind: "move", from, to });
		const [id] = order.splice(from, 1);
		order.splice(to, 0, id ?? 0);
	};

	switch (algorithm) {
		case "bubble": {
			for (let end = n - 1; end > 0; end--) {
				let swapped = false;
				for (let i = 0; i < end; i++) {
					compare(i, i + 1);
					if (v(i) > v(i + 1)) {
						swap(i, i + 1);
						swapped = true;
					}
				}
				settle(end);
				// A pass without a swap means everything left is in order.
				if (!swapped) break;
			}
			for (let s = 0; s < n; s++) settle(s);
			break;
		}
		case "insertion": {
			for (let i = 1; i < n; i++) {
				for (let j = i; j > 0; j--) {
					compare(j - 1, j);
					if (v(j - 1) <= v(j)) break;
					swap(j - 1, j);
				}
			}
			for (let s = 0; s < n; s++) settle(s);
			break;
		}
		case "quick": {
			// Lomuto partition: the last bar of the range is the pivot.
			const quick = (lo: number, hi: number) => {
				if (lo > hi) return;
				if (lo === hi) {
					settle(lo);
					return;
				}
				pivot = order[hi] ?? -1;
				let store = lo;
				for (let j = lo; j < hi; j++) {
					compare(j, hi);
					if (v(j) < v(hi)) {
						if (store !== j) swap(store, j);
						store++;
					}
				}
				if (store !== hi) swap(store, hi);
				settle(store);
				pivot = -1;
				quick(lo, store - 1);
				quick(store + 1, hi);
			};
			quick(0, n - 1);
			break;
		}
		case "merge": {
			// In place: when the right run's head is smaller, it moves in front.
			const sort = (lo: number, hi: number) => {
				if (hi <= lo) return;
				const mid = Math.floor((lo + hi) / 2);
				sort(lo, mid);
				sort(mid + 1, hi);
				let i = lo;
				let m = mid;
				let j = mid + 1;
				while (i <= m && j <= hi) {
					compare(i, j);
					if (v(i) <= v(j)) {
						i++;
					} else {
						move(j, i);
						i++;
						m++;
						j++;
					}
				}
			};
			sort(0, n - 1);
			for (let s = 0; s < n; s++) settle(s);
			break;
		}
	}

	return { ops, final: { slots: slotsNow(), settled: [...settled] } };
}
