/** Backward-compatible story data; the queue kind contains no checkout rules. */
import { arrivals, clamp, lognormal, maybe, num, obj, random } from "../kit.ts";
import type { QueueInput } from "../kinds/queue.ts";
import type { JsonValue } from "../../utils/json.ts";

export interface CheckoutOptions { registers?: number; customers?: number; slow?: number; seed?: number }

export function checkoutPreset(raw: JsonValue): QueueInput {
	const p = obj(raw, "props");
	const servers = maybe(p.registers, "props.registers", num) ?? 3;
	const count = maybe(p.customers, "props.customers", num) ?? 12;
	const slow = maybe(p.slow, "props.slow", num) ?? 0;
	const seed = maybe(p.seed, "props.seed", num) ?? 4;
	if (!Number.isInteger(servers) || servers < 2 || servers > 4) throw new Error("props.registers must be 2, 3 or 4");
	if (!Number.isInteger(count) || count < 4 || count > 14) throw new Error("props.customers must be a whole number from 4 to 14");
	if (!Number.isInteger(slow) || slow < 0 || slow >= count) throw new Error("props.slow must be the index of one of the customers");
	const rand = random(seed);
	return {
		servers,
		arrivals: arrivals(count, 0.3, seed),
		services: Array.from({ length: count }, (_, i) => i === slow ? 4.5 : clamp(lognormal(rand, 0.95, 0.25), 0.6, 1.6)),
		policies: [{ policy: "per-server", label: "Dedicated queues" }, { policy: "shared", label: "Shared queue" }],
	entryLabel: "Arrivals", doneLabel: "Done", waitingLabel: "Waiting", unit: "s",
		highlight: { index: slow, label: "Full cart" },
	};
}
