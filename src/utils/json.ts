export type JsonPrimitive = boolean | null | number | string;
export type JsonArray = JsonValue[];
export interface JsonObject {
	[key: string]: JsonValue;
}
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

/**
 * `JSON.parse` is typed as `any` by TypeScript, although valid JSON can only
 * produce this closed value set. Keep that one standard-library mismatch here
 * so domain code never receives `any` or an open-ended top type.
 */
export function parseJson(source: string): JsonValue {
	return JSON.parse(source) as JsonValue;
}

export const isJsonObject = (
	value: JsonValue | undefined,
): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);
