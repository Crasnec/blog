import textmate from "vscode-textmate";
import type { LanguageRegistration } from "shiki/core";
import { MAX_GRAMMAR, type GrammarSource } from "./contracts.ts";

/** The official TextMate parser handles both JSON and XML/plist grammars. */
export function parseGrammars(sources: readonly GrammarSource[]): LanguageRegistration[] {
	if (sources.length > 16 || sources.reduce((n, source) => n + source.content.length, 0) > MAX_GRAMMAR) throw new Error("Provide at most 16 grammars totalling 1 MB");
	const scopes = new Set<string>();
	return sources.map(({ filename, content }, index) => {
		// The parser returns plain grammar data. Shiki and Microsoft's tokenizer
		// have different private brands for compiled rule IDs, absent in this data.
		const parsed: object = textmate.parseRawGrammar(content, content.trimStart().startsWith("{") ? "grammar.json" : "grammar.tmLanguage");
		const grammar = parsed as LanguageRegistration;
		if (typeof grammar.scopeName !== "string" || !grammar.scopeName.trim() || !Array.isArray(grammar.patterns)) throw new Error(`${filename}: grammar needs scopeName and patterns`);
		if (scopes.has(grammar.scopeName)) throw new Error(`${filename}: duplicate scope ${grammar.scopeName}`);
		scopes.add(grammar.scopeName);
		return { ...grammar, name: `custom-${String(index)}`, aliases: [] };
	});
}
