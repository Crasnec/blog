/** FCFS service with either dedicated shortest queues or one pooled queue. */
export type QueuePolicy = "per-server" | "shared";
export interface Visit {
	arrive: number;
	start: number;
	end: number;
	server: number;
	ahead: number[];
}

/** Inputs have already been validated by the figure's decode boundary. */
export function simulateQueue(policy: QueuePolicy, arrivals: readonly number[], services: readonly number[], servers: number): Visit[] {
	const freeAt = Array.from({ length: servers }, () => 0);
	const visits: Visit[] = [];
	for (const [i, at] of arrivals.entries()) {
		let server = 0;
		if (policy === "per-server") {
			const present = (s: number) => visits.filter((v) => v.server === s && v.end > at).length;
			for (let s = 1; s < servers; s++) if (present(s) < present(server)) server = s;
		} else {
			for (let s = 1; s < servers; s++) if ((freeAt[s] ?? 0) < (freeAt[server] ?? 0)) server = s;
		}
		const start = Math.max(at, freeAt[server] ?? 0);
		const end = start + (services[i] ?? 0);
		freeAt[server] = end;
		visits.push({ arrive: at, start, end, server, ahead: visits.flatMap((v, j) => policy === "shared" || v.server === server ? [j] : []) });
	}
	return visits;
}
