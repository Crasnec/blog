import { type JsonValue, isJsonObject } from "../../utils/json.ts";
import { type Tone, TONES } from "./palette.ts";

/*
 * Small, strict readers for a figure's `decode`. Each takes the value and the
 * path it came from, so a bad prop fails the build with
 * `figure "line": props.series[1].values must be an array of numbers`
 * rather than drawing nothing in the browser.
 */
export class PropError extends Error {}

const fail = (path: string, expected: string): never => {
    throw new PropError(`${path} must be ${expected}`);
};

export function obj(v: JsonValue | undefined, path: string) {
    return isJsonObject(v) ? v : fail(path, "an object");
}

export function arr(v: JsonValue | undefined, path: string): JsonValue[] {
    return Array.isArray(v) ? v : fail(path, "an array");
}

export function num(v: JsonValue | undefined, path: string): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fail(path, "a number");
}

export function str(v: JsonValue | undefined, path: string): string {
    return typeof v === "string" ? v : fail(path, "a string");
}

export function nums(v: JsonValue | undefined, path: string): number[] {
    return arr(v, path).map((x, i) => num(x, `${path}[${String(i)}]`));
}

export function tone(v: JsonValue | undefined, path: string, fallback: Tone): Tone {
    if (v === undefined) {
        return fallback;
    }
    const found = TONES.find((t) => t === v);
    return found ?? fail(path, `one of ${TONES.join(", ")}`);
}

/** Reads an optional field: `undefined` when absent, decoded when present. */
export function maybe<T>(
    v: JsonValue | undefined,
    path: string,
    read: (v: JsonValue, path: string) => T,
): T | undefined {
    return v === undefined ? undefined : read(v, path);
}
