/** Deterministic random numbers in [0, 1). Same seed, same sequence. */
export function random(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let r = Math.imul(s ^ (s >>> 15), 1 | s);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** A standard normal sample (mean 0, sd 1) from a `random()` source. */
export function normal(rand: () => number): number {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Right-skewed positive values around `median`, the shape of latencies and
 * service times. `spread` is the log-space sigma: 0.2 is tight, 0.6 is wide.
 */
export const lognormal = (rand: () => number, median: number, spread: number): number =>
    median * Math.exp(spread * normal(rand));

/**
 * `count` arrival times with random gaps averaging `meanGap` seconds — how
 * independent events (requests, customers, cars) actually arrive.
 */
export function arrivals(count: number, meanGap: number, seed: number, start = 0): number[] {
    const rand = random(seed);
    const out: number[] = [];
    let at = start;
    for (let i = 0; i < count; i++) {
        out.push(at);
        at += -Math.log(Math.max(rand(), 1e-9)) * meanGap;
    }
    return out;
}

/** Picks one of `items` with a `random()` source. */
export const pick = <T>(rand: () => number, items: readonly T[]): T | undefined =>
    items[Math.floor(rand() * items.length)];

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : sum(values) / values.length;

/** The `p`th percentile (0–100) of already sorted values, nearest-rank. */
export function percentile(sorted: readonly number[], p: number): number {
    if (sorted.length === 0) {
        return 0;
    }
    const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, i)] ?? 0;
}

/**
 * A well-spread 32-bit hash of a string: FNV-1a, finished with murmur3's
 * mixer so similar strings ("key-1", "key-2") land far apart. Deterministic,
 * so it can place keys, servers or colours the same way on every build.
 */
export function hash32(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

/** 6.2 → "6.2", 7 → "7", 7.04 → "7": at most `digits` decimals, no trailing ".0". */
export function trimNumber(v: number, digits = 1): string {
    return Math.abs(v - Math.round(v)) < 1e-6
        ? String(Math.round(v))
        : v.toFixed(digits).replace(/\.?0+$/, "");
}

/**
 * A round tick spacing (1, 2 or 5 times a power of ten) that puts at most
 * `maxTicks` ticks across `span`. For time and value axes.
 */
export function tickStep(span: number, maxTicks: number): number {
    const raw = span / maxTicks;
    const base = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) {
        if (base * m >= raw) {
            return base * m;
        }
    }
    return base * 10;
}

/** Maps a domain onto a range, like d3's linear scale. */
export const scale =
    (d0: number, d1: number, r0: number, r1: number) =>
        (v: number): number =>
            d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** A round number at or above `v`, for axis maxima: 7.3k → 8k, 0.42 → 0.5. */
export function niceMax(v: number): number {
    if (v <= 0) {
        return 1;
    }
    const step = 10 ** Math.floor(Math.log10(v));
    const m = v / step;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return nice * step;
}

/** 1200 → "1.2k", 3_400_000 → "3.4M". */
export function compact(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1e6) {
        return `${trim(v / 1e6)}M`;
    }
    if (abs >= 1e3) {
        return `${trim(v / 1e3)}k`;
    }
    return trim(v);
}

const trim = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 1 : 0));

/** Compact numeric labels, retaining small magnitudes in scientific notation. */
export const formatNumber = (n: number): string => {
    if (n === 0) {
        return "0";
    }
    if (Math.abs(n) >= 10000 || Math.abs(n) < 0.001) {
        return n.toExponential(1).replace(".0e", "e").replace("e+", "e");
    }
    return Number(n.toFixed(Math.abs(n) < 1 ? 3 : 2)).toString();
};
