import type { Palette } from "#src/figures/core/definition.ts";

/**
 * Colour for "how bad is this value": ink below `warnAt`, `warn` from there,
 * `danger` from `dangerAt`. For things that get worse while you watch, such as
 * time spent waiting.
 */
export function heat(palette: Palette, value: number, warnAt: number, dangerAt: number): string {
    return value >= dangerAt ? palette.danger : value >= warnAt ? palette.warn : palette.inkMuted;
}

/** Colour names a post may use, mapped to the palette. */
export type Tone = "marker" | "ink" | "muted" | "warn" | "danger";

export const TONES: readonly Tone[] = ["marker", "ink", "muted", "warn", "danger"];

export function toneColor(palette: Palette, tone: Tone): string {
    switch (tone) {
        case "marker":
            return palette.marker;
        case "ink":
            return palette.inkStrong;
        case "muted":
            return palette.inkFaint;
        case "warn":
            return palette.warn;
        case "danger":
            return palette.danger;
    }
}
