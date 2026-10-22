import textmate from "vscode-textmate";
import type { LanguageRegistration } from "shiki/core";
import { MAX_GRAMMAR, type GrammarSource } from "./contracts.ts";
import { isJsonObject, parseJson, type JsonObject, type JsonValue } from "../utils/json.ts";

type GrammarRule = LanguageRegistration["patterns"][number];
const ruleStrings = ["include", "name", "contentName", "match", "begin", "end", "while"] as const;
const ruleMaps = [
    "captures",
    "beginCaptures",
    "endCaptures",
    "whileCaptures",
    "repository",
] as const;

function optionalString(value: JsonObject, key: string): string | undefined {
    const field = value[key];
    if (field !== undefined && typeof field !== "string")
    {
        throw new Error(`grammar ${key} must be a string`);
    }
    return field;
}

function ruleMap(value: JsonValue | undefined, depth: number): Record<string, GrammarRule> {
    if (value === undefined) {
        return {};
    }
    if (!isJsonObject(value)) {
        throw new Error("grammar captures and repositories must be objects");
    }
    return Object.fromEntries(
        Object.entries(value)
            .filter(([name]) => name !== "$vscodeTextmateLocation")
            .map(([name, rule]) => [name, parseRule(rule, depth + 1)]),
    );
}

/** Copy only validated raw fields; tokenizer-internal compiled rule IDs are never imported. */
function parseRule(value: JsonValue, depth: number): GrammarRule {
    if (depth > 64) {
        throw new Error("grammar nesting exceeds 64 levels");
    }
    if (!isJsonObject(value)) {
        throw new Error("grammar rules must be objects");
    }
    const strings: Partial<Record<(typeof ruleStrings)[number], string>> = {};
    for (const key of ruleStrings) {
        const field = optionalString(value, key);
        if (field !== undefined) {
            strings[key] = field;
        }
    }
    const maps: Partial<Record<(typeof ruleMaps)[number], Record<string, GrammarRule>>> = {};
    for (const key of ruleMaps) {
        if (value[key] !== undefined) {
            maps[key] = ruleMap(value[key], depth);
        }
    }
    if (value.patterns !== undefined && !Array.isArray(value.patterns))
    {
        throw new Error("grammar patterns must be an array");
    }
    const last = value.applyEndPatternLast;
    if (last !== undefined && typeof last !== "boolean" && last !== 0 && last !== 1)
    {
        throw new Error("grammar applyEndPatternLast must be a boolean or 0/1");
    }
    return {
        ...strings,
        ...maps,
        ...(Array.isArray(value.patterns)
            ? { patterns: value.patterns.map((rule) => parseRule(rule, depth + 1)) }
            : {}),
        ...(last !== undefined ? { applyEndPatternLast: last === true || last === 1 } : {}),
    };
}

/** The official TextMate parser handles both JSON and XML/plist grammars. */
export function parseGrammars(sources: readonly GrammarSource[]): LanguageRegistration[] {
    if (
        sources.length > 16 ||
        sources.reduce((n, source) => n + source.content.length, 0) > MAX_GRAMMAR
    )
    {
        throw new Error("Provide at most 16 grammars totalling 1 MB");
    }
    const scopes = new Set<string>();
    return sources.map(({ filename, content }, index) => {
        const parsed = textmate.parseRawGrammar(
            content,
            content.trimStart().startsWith("{") ? "grammar.json" : "grammar.tmLanguage",
        );
        // Re-enter through JSON because the parser's declaration assumes valid raw
        // grammar data. Both JSON and plist can still contain malformed nested rules.
        const grammar = parseJson(JSON.stringify(parsed));
        if (
            !isJsonObject(grammar) ||
            typeof grammar.scopeName !== "string" ||
            !grammar.scopeName.trim() ||
            !Array.isArray(grammar.patterns)
        )
        {
            throw new Error(`${filename}: grammar needs scopeName and patterns`);
        }
        if (scopes.has(grammar.scopeName))
        {
            throw new Error(`${filename}: duplicate scope ${grammar.scopeName}`);
        }
        scopes.add(grammar.scopeName);
        const injectionSelector = optionalString(grammar, "injectionSelector");
        const firstLineMatch = optionalString(grammar, "firstLineMatch");
        if (
            grammar.fileTypes !== undefined &&
            (!Array.isArray(grammar.fileTypes) ||
                !grammar.fileTypes.every((value) => typeof value === "string"))
        )
        {
            throw new Error(`${filename}: grammar fileTypes must be strings`);
        }
        return {
            scopeName: grammar.scopeName,
            patterns: grammar.patterns.map((rule) => parseRule(rule, 0)),
            repository: ruleMap(grammar.repository, 0),
            name: `custom-${String(index)}`,
            aliases: [],
            ...(grammar.injections !== undefined
                ? { injections: ruleMap(grammar.injections, 0) }
                : {}),
            ...(injectionSelector !== undefined ? { injectionSelector } : {}),
            ...(firstLineMatch !== undefined ? { firstLineMatch } : {}),
            ...(Array.isArray(grammar.fileTypes)
                ? {
                    fileTypes: grammar.fileTypes.filter(
                        (value): value is string => typeof value === "string",
                    ),
                }
                : {}),
        };
    });
}
