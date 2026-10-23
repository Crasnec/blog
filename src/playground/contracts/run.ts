import type {
    MessageValue,
    InputResponse,
    CellRequest,
    RunRequest,
    RunResponse,
} from "./types.ts";
import { isRecord, isId, decodePackages } from "./readers.ts";
import { MAX_INPUT, MAX_CODE, MAX_OUTPUT, MAX_PNG } from "./limits.ts";

export function decodeInputResponse(value: MessageValue): InputResponse | undefined {
    if (
        !isRecord(value) ||
        value.type !== "input" ||
        !isId(value.id) ||
        (value.value !== null &&
            (typeof value.value !== "string" || value.value.length > MAX_INPUT))
    ) {
        return;
    }
    return { type: "input", id: value.id, value: value.value };
}

export function decodeCellRequest(value: MessageValue): CellRequest | undefined {
    if (
        !isRecord(value) ||
        value.type !== "run" ||
        typeof value.code !== "string" ||
        value.code.length > MAX_CODE
    ) {
        return;
    }
    const pythonPackages = decodePackages(value.pythonPackages);
    if (!pythonPackages) {
        return;
    }
    return { type: "run", code: value.code, pythonPackages };
}

export function decodeRunRequest(value: MessageValue): RunRequest | undefined {
    if (
        !isRecord(value) ||
        typeof value.code !== "string" ||
        value.code.length > MAX_CODE ||
        !(value.port instanceof MessagePort) ||
        typeof value.assets !== "string" ||
        (value.runtime !== "javascript" &&
            value.runtime !== "typescript" &&
            value.runtime !== "python") ||
        (value.persistent !== undefined && typeof value.persistent !== "boolean")
    ) {
        return;
    }
    const pythonPackages = decodePackages(value.pythonPackages);
    if (
        !pythonPackages ||
        (value.runtime !== "python" && (pythonPackages.length > 0 || value.persistent === true))
    ) {
        return;
    }
    return {
        code: value.code,
        runtime: value.runtime,
        port: value.port,
        assets: value.assets,
        pythonPackages,
        ...(typeof value.persistent === "boolean" ? { persistent: value.persistent } : {}),
    };
}

export function decodeRunResponse(value: MessageValue): RunResponse | undefined {
    if (!isRecord(value) || typeof value.type !== "string") {
        return;
    }
    switch (value.type) {
        case "ready":
        case "done":
            return { type: value.type };
        case "error":
        case "status":
            if (typeof value.text === "string") {
                return { type: value.type, text: value.text };
            }
            return;
        case "output":
            if (
                typeof value.text !== "string" ||
                value.text.length > MAX_OUTPUT ||
                (value.level !== "log" && value.level !== "warn" && value.level !== "error")
            ) {
                return;
            }
            return { type: "output", text: value.text, level: value.level };
        case "input":
            if (!isId(value.id) || typeof value.prompt !== "string" || value.prompt.length > 1000) {
                return;
            }
            return { type: "input", id: value.id, prompt: value.prompt };
        case "plot": {
            if (
                !(value.png instanceof ArrayBuffer) ||
                value.png.byteLength > MAX_PNG ||
                typeof value.alt !== "string" ||
                value.alt.length > 300
            ) {
                return;
            }
            const bytes = new Uint8Array(value.png);
            if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) {
                return;
            }
            return { type: "plot", png: value.png, alt: value.alt };
        }
        default:
            return;
    }
}
