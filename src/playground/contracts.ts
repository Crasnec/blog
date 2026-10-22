import { isJsonObject, parseJson } from "../utils/json.ts";

export type Runtime = "javascript" | "typescript" | "python";
/** A micropip requirement: a package name, version constraint, or wheel URL. */
export type PythonPackage = string;
export interface GrammarSource {
    filename: string;
    content: string;
}
export interface PlaygroundConfig {
    language: string;
    runtime: Runtime | false;
    grammars: GrammarSource[];
    timeout: number;
    label: string;
    pythonPackages: PythonPackage[];
    notebook?: string;
}
export const MAX_CODE = 100_000;
export const MAX_GRAMMAR = 1_000_000;
export const MAX_INPUT = 16_000;
export const MAX_OUTPUT = 64_000;
export const MAX_PLOTS = 8;
export const MAX_PNG = 4_000_000;
export const MAX_PLOT_TOTAL = 16_000_000;

export function runtimeFor(language: string): Runtime | false {
    switch (language.toLowerCase()) {
        case "js":
        case "javascript":
            return "javascript";
        case "ts":
        case "typescript":
            return "typescript";
        case "py":
        case "python":
            return "python";
        default:
            return false;
    }
}

export function decodeConfig(source: string): PlaygroundConfig {
    const value = parseJson(source);
    if (
        !isJsonObject(value) ||
        typeof value.language !== "string" ||
        !value.language.trim() ||
        typeof value.label !== "string"
    )
    {
        throw new Error("Playground needs a language and label");
    }
    const runtime = value.runtime;
    if (
        runtime !== false &&
        runtime !== "javascript" &&
        runtime !== "typescript" &&
        runtime !== "python"
    )
    {
        throw new Error("Unsupported playground runtime");
    }
    if (
        typeof value.timeout !== "number" ||
        !Number.isFinite(value.timeout) ||
        value.timeout < 100 ||
        value.timeout > 60_000
    )
    {
        throw new Error("Playground timeout must be from 100 to 60000 milliseconds");
    }
    if (!Array.isArray(value.grammars) || value.grammars.length > 16)
    {
        throw new Error("Provide at most 16 TextMate grammars");
    }
    const grammars = value.grammars.map((grammar) => {
        if (
            !isJsonObject(grammar) ||
            typeof grammar.filename !== "string" ||
            typeof grammar.content !== "string"
        )
        {
            throw new Error("Each grammar needs filename and content strings");
        }
        return { filename: grammar.filename, content: grammar.content };
    });
    if (grammars.reduce((total, grammar) => total + grammar.content.length, 0) > MAX_GRAMMAR)
    {
        throw new Error("TextMate grammars exceed 1 MB");
    }
    const requested = value.pythonPackages ?? [];
    if (!Array.isArray(requested) || requested.length > 50)
    {
        throw new Error("pythonPackages must be an array of at most 50 requirements");
    }
    const pythonPackages = requested.map((name) => {
        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.length > 2048 ||
            /[\r\n\0]/u.test(name)
        )
        {
            throw new Error(
                "Each Python requirement must be a nonempty string of at most 2048 characters",
            );
        }
        return name;
    });
    if (
        new Set(pythonPackages).size !== pythonPackages.length ||
        (runtime !== "python" && pythonPackages.length)
    )
    {
        throw new Error("pythonPackages must be unique and require the Python runtime");
    }
    if (
        value.notebook !== undefined &&
        (typeof value.notebook !== "string" ||
            !/^[a-zA-Z][\w-]{0,79}$/u.test(value.notebook) ||
            runtime !== "python")
    )
    {
        throw new Error("A notebook needs a valid ID and the Python runtime");
    }
    return {
        language: value.language,
        label: value.label,
        runtime,
        timeout: value.timeout,
        grammars,
        pythonPackages,
        ...(typeof value.notebook === "string" ? { notebook: value.notebook } : {}),
    };
}

export interface HighlightRequest {
    id: number;
    /** Stable editor identity within a shared worker. */
    document?: number;
    /** Editor revision, independent of the shared pool's correlation ID. */
    revision?: number;
    /** Last response applied to this editor; mismatches require a complete patch. */
    base?: number;
    code: string;
    language: string;
    /** Sent once when the shared worker is initialized. */
    grammars?: GrammarSource[];
}
export interface HighlightToken {
    from: number;
    to: number;
    color: string;
    fontStyle: number;
}
export type HighlightResponse =
    | { id: number; tokens: HighlightToken[]; name: string; from?: number; to?: number }
    | { id: number; error: string };
export interface RunRequest {
    code: string;
    runtime: Runtime;
    port: MessagePort;
    assets: string;
    pythonPackages: PythonPackage[];
    persistent?: boolean;
}
export interface CellRequest {
    type: "run";
    code: string;
    pythonPackages: PythonPackage[];
}
export interface InputResponse {
    type: "input";
    id: number;
    value: string | null;
}
export type RunResponse =
    | { type: "input"; id: number; prompt: string }
    | { type: "output"; text: string; level: "log" | "error" | "warn" }
    | { type: "ready" | "done" }
    | { type: "error" | "status"; text: string }
    | { type: "plot"; png: ArrayBuffer; alt: string };

/** Values at a structured-clone boundary are checked before entering domain code. */
export type MessageValue = object | string | number | boolean | bigint | symbol | null | undefined;

const isRecord = (value: MessageValue): value is Record<string, MessageValue> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isArray = (value: MessageValue): value is MessageValue[] => Array.isArray(value);

const isId = (value: MessageValue): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function decodePackages(value: MessageValue): PythonPackage[] | undefined {
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
        )
        {
            return;
        }
        packages.push(name);
    }
    return packages;
}

export function decodeInputResponse(value: MessageValue): InputResponse | undefined {
    if (
        !isRecord(value) ||
        value.type !== "input" ||
        !isId(value.id) ||
        (value.value !== null &&
            (typeof value.value !== "string" || value.value.length > MAX_INPUT))
    )
    {
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
    )
    {
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
    )
    {
        return;
    }
    const pythonPackages = decodePackages(value.pythonPackages);
    if (
        !pythonPackages ||
        (value.runtime !== "python" && (pythonPackages.length > 0 || value.persistent === true))
    )
    {
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
            )
            {
                return;
            }
            return { type: "output", text: value.text, level: value.level };
        case "input":
            if (!isId(value.id) || typeof value.prompt !== "string" || value.prompt.length > 1000)
            {
                return;
            }
            return { type: "input", id: value.id, prompt: value.prompt };
        case "plot": {
            if (
                !(value.png instanceof ArrayBuffer) ||
                value.png.byteLength > MAX_PNG ||
                typeof value.alt !== "string" ||
                value.alt.length > 300
            )
            {
                return;
            }
            const bytes = new Uint8Array(value.png);
            if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte))
            {
                return;
            }
            return { type: "plot", png: value.png, alt: value.alt };
        }
        default:
            return;
    }
}

export function decodeHighlightRequest(value: MessageValue): HighlightRequest | undefined {
    if (
        !isRecord(value) ||
        !isId(value.id) ||
        typeof value.code !== "string" ||
        value.code.length > MAX_CODE ||
        typeof value.language !== "string" ||
        (value.document !== undefined && !isId(value.document)) ||
        (value.revision !== undefined && !isId(value.revision)) ||
        (value.base !== undefined && !isId(value.base)) ||
        (value.grammars !== undefined && (!isArray(value.grammars) || value.grammars.length > 16))
    )
    {
        return;
    }
    const grammars: GrammarSource[] = [];
    let length = 0;
    for (const grammar of value.grammars ?? []) {
        if (
            !isRecord(grammar) ||
            typeof grammar.filename !== "string" ||
            typeof grammar.content !== "string"
        )
        {
            return;
        }
        length += grammar.content.length;
        if (length > MAX_GRAMMAR) {
            return;
        }
        grammars.push({ filename: grammar.filename, content: grammar.content });
    }
    return {
        id: value.id,
        code: value.code,
        language: value.language,
        ...(value.grammars !== undefined ? { grammars } : {}),
        ...(typeof value.document === "number" ? { document: value.document } : {}),
        ...(typeof value.revision === "number" ? { revision: value.revision } : {}),
        ...(typeof value.base === "number" ? { base: value.base } : {}),
    };
}

export function decodeHighlightRelease(value: MessageValue): number | undefined {
    return isRecord(value) && value.type === "release" && isId(value.document)
        ? value.document
        : undefined;
}

export function decodeHighlightResponse(value: MessageValue): HighlightResponse | undefined {
    if (!isRecord(value) || !isId(value.id)) {
        return;
    }
    if (typeof value.error === "string") {
        return { id: value.id, error: value.error };
    }
    if (typeof value.name !== "string" || !isArray(value.tokens) || value.tokens.length > MAX_CODE)
    {
        return;
    }
    const ranged = value.from !== undefined || value.to !== undefined;
    if (
        ranged &&
        (!isId(value.from) || !isId(value.to) || value.from > value.to || value.to > MAX_CODE)
    )
    {
        return;
    }
    const tokens: HighlightToken[] = [];
    let end = 0;
    for (const token of value.tokens) {
        if (
            !isRecord(token) ||
            !isId(token.from) ||
            !isId(token.to) ||
            token.from < end ||
            token.to <= token.from ||
            token.to > MAX_CODE ||
            (typeof value.from === "number" && token.from < value.from) ||
            (typeof value.to === "number" && token.to > value.to) ||
            typeof token.color !== "string" ||
            !isId(token.fontStyle) ||
            token.fontStyle > 15
        )
        {
            return;
        }
        tokens.push({
            from: token.from,
            to: token.to,
            color: token.color,
            fontStyle: token.fontStyle,
        });
        end = token.to;
    }
    return {
        id: value.id,
        name: value.name,
        tokens,
        ...(typeof value.from === "number" && typeof value.to === "number"
            ? { from: value.from, to: value.to }
            : {}),
    };
}
