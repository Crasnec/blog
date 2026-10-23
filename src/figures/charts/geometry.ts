import type { Series, Segment, Domain } from "#src/figures/charts/types.ts";
import { tickStep } from "#src/figures/kit.ts";

/** Negative and positive stacks each start at zero. Percent stacks have no negatives. */
export function segments(series: Series[], stacked: boolean, percent: boolean): Segment[][] {
    const count = series[0]?.values.length ?? 0;
    const positive = Array<number>(count).fill(0);
    const negative = Array<number>(count).fill(0);
    const totals = Array.from({ length: count }, (_, i) =>
        series.reduce((total, s) => total + (s.values[i] ?? 0), 0),
    );
    return series.map((s) =>
        s.values.map((raw, i) => {
            const total = totals[i] ?? 0;
            const value = percent ? (total === 0 ? 0 : (raw / total) * 100) : raw;
            const accumulator = value < 0 ? negative : positive;
            const from = stacked ? (accumulator[i] ?? 0) : 0;
            const to = from + value;
            accumulator[i] = to;
            return { from, to, value };
        }),
    );
}

export function numericDomain(min: number, max: number): Domain {
    if (min === max) {
        max = min + 1;
    }
    const step = tickStep(max - min, 4);
    const first = Math.floor(min / step);
    const last = Math.ceil(max / step);
    return {
        min: first * step,
        max: last * step,
        ticks: Array.from({ length: last - first + 1 }, (_, i) => (first + i) * step),
    };
}

export function dataDomain(data: Segment[][], percent: boolean): Domain {
    if (percent) {
        return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
    }
    let min = 0;
    let max = 0;
    for (const row of data) {
        for (const cell of row) {
            min = Math.min(min, cell.from, cell.to);
            max = Math.max(max, cell.from, cell.to);
        }
    }
    return numericDomain(min, max);
}
