/** Pure statistical models. No canvas, randomness, or frame state. */
import { mean, sum, type Point } from "../kit.ts";

/** R-7 / NumPy's default linear sample quantile. Input must be sorted. */
export function quantile(sorted: readonly number[], p: number): number {
    if (sorted.length === 0 || p < 0 || p > 1 || !Number.isFinite(p))
        throw new Error("quantile needs a nonempty sample and a probability in [0, 1]");
    const index = (sorted.length - 1) * p;
    const lo = Math.floor(index);
    const a = sorted[lo] ?? 0;
    return a + ((sorted[Math.min(lo + 1, sorted.length - 1)] ?? a) - a) * (index - lo);
}

export function variance(values: readonly number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    return sum(values.map((v) => (v - m) ** 2)) / (values.length - 1);
}

export function boxSummary(sorted: readonly number[]) {
    const q1 = quantile(sorted, 0.25);
    const median = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const inside = sorted.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    return {
        q1,
        median,
        q3,
        low: inside[0] ?? median,
        high: inside.at(-1) ?? median,
        outliers: sorted.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr),
    };
}

/** Silverman's robust rule; constant samples use a finite scale fallback. */
export function bandwidth(sorted: readonly number[]): number {
    const sd = Math.sqrt(variance(sorted));
    const iqr = (quantile(sorted, 0.75) - quantile(sorted, 0.25)) / 1.34;
    const spread = Math.min(sd, iqr) || sd || Math.max(1, Math.abs(sorted[0] ?? 0) * 0.05);
    return 0.9 * spread * sorted.length ** -0.2;
}

export function kdeAt(values: readonly number[], x: number, h: number): number {
    return (
        sum(values.map((v) => Math.exp(-0.5 * ((x - v) / h) ** 2))) /
        (values.length * h * Math.sqrt(2 * Math.PI))
    );
}

export function density(
    values: readonly number[],
    domain: [number, number],
    h: number,
    count = 81,
): Point[] {
    return Array.from({ length: count }, (_, i) => {
        const x = domain[0] + ((domain[1] - domain[0]) * i) / (count - 1);
        return { x, y: kdeAt(values, x, h) };
    });
}

export function ecdf(sorted: readonly number[]): Point[] {
    const points: Point[] = [];
    let before = 0;
    for (let i = 0; i < sorted.length;) {
        const x = sorted[i] ?? 0;
        let end = i + 1;
        while (sorted[end] === x) end++;
        points.push({ x, y: before }, { x, y: end / sorted.length });
        before = end / sorted.length;
        i = end;
    }
    return points;
}

/** Standard normal CDF, Abramowitz–Stegun 7.1.26 (absolute error < 1e-7). */
export function normalCdf(z: number): number {
    const x = Math.abs(z) / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * x);
    const erf =
        1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
            0.254829592) *
            t *
            Math.exp(-x * x);
    return (1 + (z < 0 ? -erf : erf)) / 2;
}

/** Invert the CDF by bisection; plotting positions never include 0 or 1. */
export function normalQuantile(p: number): number {
    if (!(p > 0 && p < 1)) throw new Error("normal quantile probability must be between 0 and 1");
    let lo = -9;
    let hi = 9;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (normalCdf(mid) < p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

export function linearFit(points: readonly Point[]) {
    if (points.length < 3) throw new Error("regression needs at least 3 points");
    const mx = mean(points.map((p) => p.x));
    const my = mean(points.map((p) => p.y));
    const xx = sum(points.map((p) => (p.x - mx) ** 2));
    if (xx === 0) throw new Error("regression needs at least two distinct x values");
    const slope = sum(points.map((p) => (p.x - mx) * (p.y - my))) / xx;
    const intercept = my - slope * mx;
    const residuals = points.map((p) => p.y - (intercept + slope * p.x));
    const sse = sum(residuals.map((r) => r * r));
    const mse = sse / (points.length - 2);
    const total = sum(points.map((p) => (p.y - my) ** 2));
    const diagnostics = points.map((p, i) => {
        const residual = residuals[i] ?? 0;
        const leverage = 1 / points.length + (p.x - mx) ** 2 / xx;
        const denominator = Math.sqrt(mse * Math.max(0, 1 - leverage));
        const standardized = denominator > 0 ? residual / denominator : 0;
        const cook =
            mse > 0 && leverage < 1
                ? ((residual ** 2 / (2 * mse)) * leverage) / (1 - leverage) ** 2
                : 0;
        return { x: p.x, fitted: intercept + slope * p.x, residual, leverage, standardized, cook };
    });
    return {
        slope,
        intercept,
        mse,
        r2: total === 0 ? 1 : Math.max(0, 1 - sse / total),
        diagnostics,
    };
}

/** Biased ACF: one common sum-of-squares denominator for every lag. */
export function autocorrelation(values: readonly number[], maxLag: number): number[] {
    const m = mean(values);
    const centered = values.map((v) => v - m);
    const denominator = sum(centered.map((v) => v * v));
    if (denominator === 0) throw new Error("autocorrelation is undefined for a constant series");
    return Array.from(
        { length: maxLag + 1 },
        (_, lag) => sum(centered.slice(lag).map((v, i) => v * (centered[i] ?? 0))) / denominator,
    );
}

/** Yule–Walker PACF using Durbin–Levinson recursion and the biased ACF. */
export function partialAutocorrelation(acf: readonly number[]): number[] {
    const out = [1];
    let previous: number[] = [];
    let error = 1;
    for (let k = 1; k < acf.length; k++) {
        const numerator = (acf[k] ?? 0) - sum(previous.map((v, j) => v * (acf[k - j - 1] ?? 0)));
        const last = error > 1e-14 ? numerator / error : 0;
        const current = previous.map((v, j) => v - last * (previous[k - j - 2] ?? 0));
        current.push(last);
        out.push(last);
        error *= 1 - last * last;
        previous = current;
    }
    return out;
}

export interface Scored {
    score: number;
    positive: boolean;
}

/** Group tied scores before advancing either curve, so order cannot change AUC. */
export function binaryCurves(data: readonly Scored[]) {
    const sorted = [...data].sort((a, b) => b.score - a.score);
    const positives = data.filter((d) => d.positive).length;
    const negatives = data.length - positives;
    if (positives === 0 || negatives === 0)
        throw new Error("binary curves need both positive and negative labels");
    const roc: Point[] = [{ x: 0, y: 0 }];
    const pr: Point[] = [{ x: 0, y: 1 }];
    let tp = 0;
    let fp = 0;
    let auc = 0;
    let ap = 0;
    for (let i = 0; i < sorted.length;) {
        const score = sorted[i]?.score;
        const beforeTp = tp;
        const beforeFp = fp;
        do {
            if (sorted[i]?.positive) tp++;
            else fp++;
            i++;
        } while (i < sorted.length && sorted[i]?.score === score);
        const recall = tp / positives;
        const precision = tp / (tp + fp);
        roc.push({ x: fp / negatives, y: recall });
        pr.push({ x: recall, y: precision });
        auc += (((fp - beforeFp) / negatives) * (tp + beforeTp)) / (2 * positives);
        ap += ((tp - beforeTp) / positives) * precision;
    }
    return { roc, pr, auc, ap, prevalence: positives / data.length };
}

/** Equal-width probability bins. Empty bins stay absent, never become zeros. */
export function calibrationBins(data: readonly Scored[], count: number) {
    const bins = Array.from({ length: count }, () => [] as Scored[]);
    for (const point of data)
        bins[Math.min(count - 1, Math.floor(point.score * count))]?.push(point);
    return bins.flatMap((bin) => {
        if (bin.length === 0) return [];
        return [
            {
                x: mean(bin.map((p) => p.score)),
                y: bin.filter((p) => p.positive).length / bin.length,
                count: bin.length,
            },
        ];
    });
}

export interface SurvivalObservation {
    time: number;
    event: boolean;
}

/** Events precede censor removals at the same time; log-log Greenwood 95% bands. */
export function kaplanMeier(data: readonly SurvivalObservation[]) {
    const sorted = [...data].sort((a, b) => a.time - b.time);
    let risk = sorted.length;
    let survival = 1;
    let greenwood = 0;
    const steps = [{ time: 0, survival: 1, low: 1, high: 1, risk, events: 0, censored: 0 }];
    for (let i = 0; i < sorted.length;) {
        const time = sorted[i]?.time ?? 0;
        let events = 0;
        let censored = 0;
        do {
            if (sorted[i]?.event) events++;
            else censored++;
            i++;
        } while (sorted[i]?.time === time);
        survival *= 1 - events / risk;
        if (events > 0 && risk > events) greenwood += events / (risk * (risk - events));
        let low = survival;
        let high = survival;
        if (survival > 0 && survival < 1) {
            const log = Math.log(-Math.log(survival));
            const se = Math.sqrt(greenwood) / Math.abs(Math.log(survival));
            low = Math.exp(-Math.exp(log + 1.95996398454 * se));
            high = Math.exp(-Math.exp(log - 1.95996398454 * se));
        }
        steps.push({ time, survival, low, high, risk, events, censored });
        risk -= events + censored;
    }
    return steps;
}

export function histogram(
    values: readonly number[],
    domain: [number, number],
    bins: number,
): number[] {
    const counts = Array.from({ length: bins }, () => 0);
    for (const value of values) {
        const index = Math.min(
            bins - 1,
            Math.max(0, Math.floor(((value - domain[0]) / (domain[1] - domain[0])) * bins)),
        );
        counts[index] = (counts[index] ?? 0) + 1;
    }
    return counts;
}

/** Axial pointy-top hexagons in a fixed normalized coordinate system. */
export function hexBins(
    points: readonly Point[],
    xd: [number, number],
    yd: [number, number],
    columns: number,
) {
    const sx = columns * Math.sqrt(3);
    const sy = columns * 1.5;
    const bins = new Map<string, { q: number; r: number; count: number }>();
    for (const p of points) {
        const x = ((p.x - xd[0]) / (xd[1] - xd[0])) * sx;
        const y = ((p.y - yd[0]) / (yd[1] - yd[0])) * sy;
        const q = x / Math.sqrt(3) - y / 3;
        const r = (2 * y) / 3;
        let a = Math.round(q);
        let b = Math.round(r);
        const c = Math.round(-q - r);
        const da = Math.abs(a - q);
        const db = Math.abs(b - r);
        const dc = Math.abs(c + q + r);
        if (da > db && da > dc) a = -b - c;
        else if (db > dc) b = -a - c;
        const key = `${String(a)},${String(b)}`;
        const previous = bins.get(key);
        bins.set(key, { q: a, r: b, count: (previous?.count ?? 0) + 1 });
    }
    return [...bins.values()].map((bin) => {
        const x = Math.sqrt(3) * (bin.q + bin.r / 2);
        const y = 1.5 * bin.r;
        return {
            count: bin.count,
            vertices: Array.from({ length: 6 }, (_, i) => {
                const angle = ((30 + 60 * i) * Math.PI) / 180;
                return {
                    x: xd[0] + ((x + Math.cos(angle)) / sx) * (xd[1] - xd[0]),
                    y: yd[0] + ((y + Math.sin(angle)) / sy) * (yd[1] - yd[0]),
                };
            }),
        };
    });
}

/** Gaussian product KDE and marching squares. Levels are density, not mass. */
export function densityContours(
    points: readonly Point[],
    xd: [number, number],
    yd: [number, number],
    hx: number,
    hy: number,
    size = 29,
) {
    const grid = Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => {
            const x = xd[0] + (col / (size - 1)) * (xd[1] - xd[0]);
            const y = yd[0] + (row / (size - 1)) * (yd[1] - yd[0]);
            return (
                sum(
                    points.map((p) =>
                        Math.exp(-0.5 * (((x - p.x) / hx) ** 2 + ((y - p.y) / hy) ** 2)),
                    ),
                ) /
                (points.length * 2 * Math.PI * hx * hy)
            );
        }),
    );
    const peak = Math.max(...grid.flat());
    if (!Number.isFinite(peak) || peak <= 0)
        throw new Error(
            "props.bandwidthX and props.bandwidthY must resolve a finite density on the data range",
        );
    return [0.15, 0.35, 0.6, 0.85].map((fraction) => {
        const level = peak * fraction;
        const segments: [Point, Point][] = [];
        for (let r = 0; r < size - 1; r++)
            for (let c = 0; c < size - 1; c++) {
                const corners = [
                    { x: c, y: r },
                    { x: c + 1, y: r },
                    { x: c + 1, y: r + 1 },
                    { x: c, y: r + 1 },
                ];
                const values = corners.map((p) => grid[p.y]?.[p.x] ?? 0);
                const crossings: Point[] = [];
                for (let i = 0; i < 4; i++) {
                    const j = (i + 1) % 4;
                    const a = values[i] ?? 0;
                    const b = values[j] ?? 0;
                    if (a >= level === b >= level) continue;
                    const from = corners[i] ?? { x: 0, y: 0 };
                    const to = corners[j] ?? from;
                    const t = (level - a) / (b - a);
                    crossings.push({
                        x: xd[0] + ((from.x + (to.x - from.x) * t) / (size - 1)) * (xd[1] - xd[0]),
                        y: yd[0] + ((from.y + (to.y - from.y) * t) / (size - 1)) * (yd[1] - yd[0]),
                    });
                }
                if (crossings.length === 4 && (values[0] ?? 0) >= level !== mean(values) >= level)
                    crossings.push(crossings.shift() ?? { x: 0, y: 0 });
                for (let i = 0; i + 1 < crossings.length; i += 2) {
                    const a = crossings[i];
                    const b = crossings[i + 1];
                    if (a && b) segments.push([a, b]);
                }
            }
        return { fraction, level, segments };
    });
}
