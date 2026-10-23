export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 before `start`, 1 after `start + length`, linear in between. */
export const progress = (time: number, start: number, length: number): number =>
    length <= 0 ? (time >= start ? 1 : 0) : clamp((time - start) / length);

export const ease = {
    linear: (t: number) => t,
    out: (t: number) => 1 - (1 - t) ** 3,
    inOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    /** Overshoots a little and settles — for things that land. */
    back: (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
    /** Gentle at both ends; for slow, continuous motion. */
    sine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
    /** Fast in, then a soft stop. */
    expo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
};

/** True while `start <= time < end`. */
export const between = (time: number, start: number, end: number): boolean =>
    time >= start && time < end;

/**
 * Up and back down once over `length` seconds: 0 → 1 → 0. For a flash, a
 * highlight that comes and goes, or a node that pulses when something arrives.
 */
export const flash = (time: number, start: number, length: number): number =>
    Math.sin(Math.PI * progress(time, start, length));

/** A steady 0–1 oscillation, for things that should look alive while waiting. */
export const pulse = (time: number, period = 1.2): number =>
    (1 - Math.cos((2 * Math.PI * time) / period)) / 2;

/**
 * When item `i` of `n` starts, if the whole group starts at `start` and the
 * last one starts at `start + span`. For things that appear one after another.
 */
export const stagger = (i: number, n: number, start: number, span: number): number =>
    n <= 1 ? start : start + (span * i) / (n - 1);

/**
 * Turns a list of step lengths into start times, so a story is written as
 * durations and the arithmetic is done once:
 *
 *   const T = phases({ appear: 0.6, fill: 1.2, drain: 2, verdict: 0.5 });
 *   T.fill    // 0.6, when `fill` starts
 *   T.end     // 4.3, when the last step ends
 */
export function phases<K extends string>(steps: Record<K, number>): Record<K | "end", number> {
    let at = 0;
    const out: Record<K | "end", number> = { ...steps, end: 0 };
    for (const key in steps) {
        if (!Object.hasOwn(steps, key)) {
            continue;
        }
        out[key] = at;
        at += steps[key];
    }
    out.end = at;
    return out;
}

/** A number that counts from `from` to `to` while `t` goes 0 → 1. */
export const countUp = (from: number, to: number, t: number): number =>
    from + (to - from) * ease.out(clamp(t));
