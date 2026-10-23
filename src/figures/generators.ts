/** Deterministic author-side data helpers; renderers accept their resulting arrays. */
import { arrivals, lognormal, random } from "#src/figures/kit.ts";
import type { Request } from "#src/figures/models/memory.ts";
import type { Job } from "#src/figures/models/gantt.ts";

export function numberSamples(
    count: number,
    {
        seed = 1,
        min = 0,
        max = 1,
        integer = false,
    }: { seed?: number; min?: number; max?: number; integer?: boolean } = {},
): number[] {
    if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > 2000 ||
        ![seed, min, max, max - min].every(Number.isFinite) ||
        max < min
    )
    {
        throw new Error("numberSamples needs 1–2000 samples and finite ordered bounds");
    }
    if (integer && (!Number.isInteger(min) || !Number.isInteger(max)))
    {
        throw new Error("integer numberSamples needs integer bounds");
    }
    const rand = random(seed);
    return Array.from({ length: count }, () =>
        integer ? min + Math.floor(rand() * (max - min + 1)) : min + rand() * (max - min),
    );
}

/** Shuffle a copy, so several figures can share the original input safely. */
export function shuffledValues(values: readonly number[], seed = 1): number[] {
    if (values.length > 2000 || !values.every(Number.isFinite) || !Number.isFinite(seed))
    {
        throw new Error("shuffledValues needs at most 2000 finite values and a finite seed");
    }
    const shuffled = [...values];
    const rand = random(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const a = shuffled[i] ?? 0;
        shuffled[i] = shuffled[j] ?? 0;
        shuffled[j] = a;
    }
    return shuffled;
}

export function generateRequests(count: number, seed: number): Request[] {
    if (!Number.isInteger(count) || count < 1 || count > 24 || !Number.isFinite(seed))
    {
        throw new Error("generateRequests needs 1–24 requests and a finite seed");
    }
    const rand = random(seed);
    const live: string[] = [];
    const out: Request[] = [];
    let n = 0;
    for (let i = 0; i < count; i++) {
        if (live.length > 0 && rand() < 0.35) {
            const [id] = live.splice(Math.floor(rand() * live.length), 1);
            if (id !== undefined) {
                out.push({ op: "free", id });
            }
        } else {
            const id = String.fromCharCode(65 + (n++ % 26));
            out.push({ op: "alloc", id, size: 2 + Math.floor(rand() * 7) });
            live.push(id);
        }
    }
    return out;
}

export function generateJobs(count: number, seed: number): Job[] {
    if (!Number.isInteger(count) || count < 1 || count > 10 || !Number.isFinite(seed))
    {
        throw new Error("generateJobs needs 1–10 jobs and a finite seed");
    }
    const rand = random(seed + 101);
    return arrivals(count, 1.2, seed, 0).map((at, i) => ({
        id: `P${String(i + 1)}`,
        arrive: Math.round(at),
        burst: 1 + Math.floor(rand() * 7),
    }));
}

export function lognormalSamples(count: number, median: number, spread: number, seed: number) {
    if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > 2000 ||
        ![median, spread, seed].every(Number.isFinite) ||
        median <= 0 ||
        spread < 0
    )
    {
        throw new Error(
            "lognormalSamples needs 1–2000 samples, a positive median, nonnegative spread and a finite seed",
        );
    }
    const rand = random(seed);
    const values = Array.from({ length: count }, () => lognormal(rand, median, spread));
    if (!values.every(Number.isFinite))
    {
        throw new Error("lognormalSamples overflowed; reduce the median or spread");
    }
    return values;
}
