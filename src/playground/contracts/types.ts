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
