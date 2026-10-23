import { isJsonObject, type JsonValue } from "../utils/json.ts";

export interface SeriesMetadata {
    name: string;
    order: number;
}

function positiveOrder(value: JsonValue | undefined, field: string): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError(`${field} must be a positive safe integer`);
    }
    return value;
}

export function parsePostOrder(value: JsonValue | undefined): number | undefined {
    return value === undefined ? undefined : positiveOrder(value, "order");
}

export function parseSeriesMetadata(value: JsonValue | undefined): SeriesMetadata | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!isJsonObject(value) || typeof value.name !== "string" || !value.name.trim()) {
        throw new TypeError("series.name must be a nonempty string");
    }
    const order = positiveOrder(value.order, "series.order");
    return { name: value.name.trim(), order };
}
