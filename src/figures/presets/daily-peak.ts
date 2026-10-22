/** Compatibility data generator; no heatmap rendering logic lives here. */
import { arr, maybe, num, obj, random, str } from "../kit.ts";
import type { JsonValue } from "../../utils/json.ts";

/**
 * The `daily-peak` model: a weekday × hour matrix with a quiet night, an
 * evening peak, quieter weekends and optional one-off spikes.
 *
 *   base       the quiet-hour value                         (default 100)
 *   peak       how much the evening peak adds on top         (default 400)
 *   peakHour   column index of the peak                      (default 20)
 *   spread     how many columns the peak spans, ~1 sigma     (default 2.5)
 *   daytime    share of the peak the working day carries     (default 0.35)
 *   weekend    row labels that get `weekendFactor` of peaks  (default [])
 *   weekendFactor                                            (default 0.45)
 *   spikes     [{ row: "Mon", col: "09:00", add: 600 }]         (default [])
 *   noise      multiplicative jitter, 0.1 = ±10% or so       (default 0.08)
 *   seed       for the jitter                                (default 1)
 */
export function dailyPeak(
    spec: Record<string, JsonValue>,
    rows: string[],
    cols: string[],
    path: string,
): number[][] {
    const base = maybe(spec.base, `${path}.base`, num) ?? 100;
    const peak = maybe(spec.peak, `${path}.peak`, num) ?? 400;
    const peakHour = maybe(spec.peakHour, `${path}.peakHour`, num) ?? 20;
    const spread = maybe(spec.spread, `${path}.spread`, num) ?? 2.5;
    const daytime = maybe(spec.daytime, `${path}.daytime`, num) ?? 0.35;
    const weekendFactor = maybe(spec.weekendFactor, `${path}.weekendFactor`, num) ?? 0.45;
    const noise = maybe(spec.noise, `${path}.noise`, num) ?? 0.08;
    const seed = maybe(spec.seed, `${path}.seed`, num) ?? 1;
    const weekend = new Set(
        arr(spec.weekend ?? [], `${path}.weekend`).map((v, i) => {
            const name = str(v, `${path}.weekend[${String(i)}]`);
            if (!rows.includes(name))
            {
                throw new Error(
                    `${path}.weekend[${String(i)}] is "${name}", which is not one of the rows`,
                );
            }
            return name;
        }),
    );
    const spikes = arr(spec.spikes ?? [], `${path}.spikes`).map((s, i) => {
        const p = `${path}.spikes[${String(i)}]`;
        const o = obj(s, p);
        const row = rows.indexOf(str(o.row, `${p}.row`));
        const col = cols.indexOf(str(o.col, `${p}.col`));
        if (row < 0) {
            throw new Error(`${p}.row is not one of the rows: ${rows.join(", ")}`);
        }
        if (col < 0) {
            throw new Error(`${p}.col is not one of the cols`);
        }
        return { row, col, add: num(o.add, `${p}.add`) };
    });

    const rand = random(seed);
    const n = cols.length;
    return rows.map((name, r) => {
        const factor = weekend.has(name) ? weekendFactor : 1;
        return cols.map((_, c) => {
            // Distance to the peak on a 24-hour clock, so 23:00 is near 00:00.
            const d = Math.min(Math.abs(c - peakHour), n - Math.abs(c - peakHour));
            const evening = Math.exp(-(d * d) / (2 * spread * spread));
            // Working hours (roughly 9–18 on a 24-column day) carry a plateau.
            const hour = (c / n) * 24;
            const day = hour >= 9 && hour < 18 ? daytime : 0;
            const jitter = 1 + noise * (rand() * 2 - 1);
            const spike = spikes
                .filter((s) => s.row === r && s.col === c)
                .reduce((a, s) => a + s.add, 0);
            return Math.round((base + peak * factor * Math.max(evening, day)) * jitter + spike);
        });
    });
}
