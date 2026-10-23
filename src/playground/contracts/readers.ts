import type { MessageValue, PythonPackage } from "#src/playground/contracts/types.ts";

export const isRecord = (value: MessageValue): value is Record<string, MessageValue> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const isArray = (value: MessageValue): value is MessageValue[] => Array.isArray(value);

export const isId = (value: MessageValue): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function decodePackages(value: MessageValue): PythonPackage[] | undefined {
    if (!isArray(value) || value.length > 50) {
        return;
    }
    const packages: PythonPackage[] = [];
    for (const name of value) {
        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.length > 2048 ||
            /[\r\n\0]/u.test(name) ||
            packages.includes(name)
        ) {
            return;
        }
        packages.push(name);
    }
    return packages;
}
