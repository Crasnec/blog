/** Reusable deterministic model, independent of canvas rendering and post data. */
export const EPS = 1e-9;
const MAX_EVENTS = 10_000;

export type Policy = "fcfs" | "sjf" | "rr";

export interface Job {
	id: string;
	arrive: number;
	burst: number;
}

/** A piece of CPU time given to one job on one core. */
export interface Slice {
	job: number;
	core: number;
	start: number;
	end: number;
}

export interface Outcome {
	/** When the job's last slice ends. */
	done: number;
	turnaround: number;
	wait: number;
	/** Stretches between arrival and completion when the job was not running. */
	waits: { start: number; end: number }[];
}

export interface Schedule {
	slices: Slice[];
	outcomes: Outcome[];
	end: number;
	/** Times a core switched to a different job than the one it just ran. */
	switches: number;
}

/*
 * An event-driven scheduler. Time jumps from one event (an arrival or the end
 * of a slice) to the next; at each, finished slices are retired, arrivals join
 * the ready queue, a preempted job rejoins behind them (the usual round-robin
 * convention), and every idle core takes the next job the policy picks.
 */
export function schedule(jobs: Job[], policy: Policy, quantum: number, cores: number): Schedule {
	const remaining = jobs.map((j) => j.burst);
	const order = jobs.map((_, i) => i).sort((a, b) => (jobs[a]?.arrive ?? 0) - (jobs[b]?.arrive ?? 0) || a - b);
	const ready: number[] = [];
	const running: ({ job: number; start: number; end: number } | null)[] = Array.from({ length: cores }, () => null);
	const slices: Slice[] = [];
	let next = 0;
	let t = 0;

	const admit = () => {
		while (next < order.length && (jobs[order[next] ?? 0]?.arrive ?? 0) <= t + EPS) {
			ready.push(order[next] ?? 0);
			next++;
		}
	};
	const pick = (): number | undefined => {
		if (ready.length === 0) return undefined;
		let at = 0;
		if (policy === "sjf") {
			for (let k = 1; k < ready.length; k++) {
				const a = ready[k] ?? 0;
				const b = ready[at] ?? 0;
				const da = jobs[a]?.burst ?? 0;
				const db = jobs[b]?.burst ?? 0;
				if (da < db - EPS || (Math.abs(da - db) <= EPS && (jobs[a]?.arrive ?? 0) < (jobs[b]?.arrive ?? 0) - EPS)) at = k;
			}
		}
		return ready.splice(at, 1)[0];
	};

	admit();
	for (let guard = 0; guard < MAX_EVENTS; guard++) {
		for (let c = 0; c < cores; c++) {
			if (running[c]) continue;
			const job = pick();
			if (job === undefined) break;
			const length = policy === "rr" ? Math.min(quantum, remaining[job] ?? 0) : (remaining[job] ?? 0);
			running[c] = { job, start: t, end: t + length };
		}

		const busy = running.filter((r) => r !== null);
		const nextArrival = next < order.length ? (jobs[order[next] ?? 0]?.arrive ?? Infinity) : Infinity;
		if (busy.length === 0 && nextArrival === Infinity) break;
		t = Math.min(nextArrival, ...busy.map((r) => r.end));

		// Arrivals at this instant queue up before a job preempted at it.
		admit();
		for (let c = 0; c < cores; c++) {
			const r = running[c];
			if (!r || r.end > t + EPS) continue;
			slices.push({ job: r.job, core: c, start: r.start, end: r.end });
			remaining[r.job] = (remaining[r.job] ?? 0) - (r.end - r.start);
			if ((remaining[r.job] ?? 0) > EPS) ready.push(r.job);
			running[c] = null;
		}
	}

	if (remaining.some((left) => left > EPS)) {
		throw new Error(
			`this schedule exceeds ${String(MAX_EVENTS)} events; use a larger props.quantum or smaller props.jobs bursts`,
		);
	}

	const outcomes = jobs.map((job, i): Outcome => {
		const own = slices.filter((s) => s.job === i).sort((a, b) => a.start - b.start);
		const done = Math.max(...own.map((s) => s.end));
		const waits: Outcome["waits"] = [];
		let cursor = job.arrive;
		for (const s of own) {
			if (s.start > cursor + EPS) waits.push({ start: cursor, end: s.start });
			cursor = s.end;
		}
		return { done, turnaround: done - job.arrive, wait: done - job.arrive - job.burst, waits };
	});

	let switches = 0;
	for (let c = 0; c < cores; c++) {
		const own = slices.filter((s) => s.core === c).sort((a, b) => a.start - b.start);
		for (let k = 1; k < own.length; k++) if (own[k]?.job !== own[k - 1]?.job) switches++;
	}

	return { slices, outcomes, end: Math.max(...slices.map((s) => s.end)), switches };
}
