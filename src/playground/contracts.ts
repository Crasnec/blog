import { isJsonObject, parseJson } from "../utils/json.ts";

export type Runtime = "javascript" | "typescript" | "python";
/** A micropip requirement: a package name, version constraint, or wheel URL. */
export type PythonPackage = string;
export interface GrammarSource { filename: string; content: string }
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
		case "js": case "javascript": return "javascript";
		case "ts": case "typescript": return "typescript";
		case "py": case "python": return "python";
		default: return false;
	}
}

export function decodeConfig(source: string): PlaygroundConfig {
	const value = parseJson(source);
	if (!isJsonObject(value) || typeof value.language !== "string" || !value.language.trim() || typeof value.label !== "string") throw new Error("Playground needs a language and label");
	const runtime = value.runtime;
	if (runtime !== false && runtime !== "javascript" && runtime !== "typescript" && runtime !== "python") throw new Error("Unsupported playground runtime");
	if (typeof value.timeout !== "number" || !Number.isFinite(value.timeout) || value.timeout < 100 || value.timeout > 60_000) throw new Error("Playground timeout must be from 100 to 60000 milliseconds");
	if (!Array.isArray(value.grammars) || value.grammars.length > 16) throw new Error("Provide at most 16 TextMate grammars");
	const grammars = value.grammars.map((grammar) => {
		if (!isJsonObject(grammar) || typeof grammar.filename !== "string" || typeof grammar.content !== "string") throw new Error("Each grammar needs filename and content strings");
		return { filename: grammar.filename, content: grammar.content };
	});
	if (grammars.reduce((total, grammar) => total + grammar.content.length, 0) > MAX_GRAMMAR) throw new Error("TextMate grammars exceed 1 MB");
	const requested = value.pythonPackages ?? [];
	if (!Array.isArray(requested) || requested.length > 50) throw new Error("pythonPackages must be an array of at most 50 requirements");
	const pythonPackages = requested.map((name) => {
		if (typeof name !== "string" || !name.trim() || name.length > 2048 || /[\r\n\0]/u.test(name)) throw new Error("Each Python requirement must be a nonempty string of at most 2048 characters");
		return name;
	});
	if (new Set(pythonPackages).size !== pythonPackages.length || (runtime !== "python" && pythonPackages.length)) throw new Error("pythonPackages must be unique and require the Python runtime");
	if (value.notebook !== undefined && (typeof value.notebook !== "string" || !/^[a-zA-Z][\w-]{0,79}$/u.test(value.notebook) || runtime !== "python")) throw new Error("A notebook needs a valid ID and the Python runtime");
	return { language: value.language, label: value.label, runtime, timeout: value.timeout, grammars, pythonPackages, ...(typeof value.notebook === "string" ? { notebook: value.notebook } : {}) };
}

export interface HighlightRequest { id: number; code: string; language: string; grammars: GrammarSource[] }
export interface HighlightToken { from: number; to: number; color: string; fontStyle: number }
export type HighlightResponse = { id: number; tokens: HighlightToken[]; name: string } | { id: number; error: string };
export interface RunRequest { code: string; runtime: Runtime; port: MessagePort; assets: string; pythonPackages: PythonPackage[]; persistent?: boolean }
export interface CellRequest { type: "run"; code: string; pythonPackages: PythonPackage[] }
export interface InputResponse { type: "input"; id: number; value: string | null }
export type RunResponse = { type: "input"; id: number; prompt: string } | { type: "output"; text: string; level: "log" | "error" | "warn" } | { type: "ready" | "done" } | { type: "error" | "status"; text: string } | { type: "plot"; png: ArrayBuffer; alt: string };
