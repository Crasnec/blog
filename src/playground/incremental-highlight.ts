import { splitLines, type GrammarState, type HighlighterCore } from "shiki/core";
import { MAX_CODE, type HighlightToken } from "./contracts.ts";

interface CachedLine {
    text: string;
    tokens: HighlightToken[];
    state: GrammarState | undefined;
}

interface CachedDocument {
    id: number;
    length: number;
    language: string;
    lines: CachedLine[];
}

/** State stacks include multiline delimiters/captures; scope names alone are insufficient. */
function sameState(left: GrammarState | undefined, right: GrammarState | undefined): boolean {
    if (left === right) {
        return true;
    }
    const before = left?.getInternalStack();
    const after = right?.getInternalStack();
    return before !== undefined && after !== undefined && before.equals(after);
}

/** Cache line-local tokens so inserting lines never rewrites the unchanged suffix. */
export class IncrementalHighlighter {
    private readonly documents = new Map<number, CachedDocument>();
    private size = 0;
    private readonly engine: HighlighterCore;
    private readonly theme: string;

    constructor(engine: HighlighterCore, theme: string) {
        this.engine = engine;
        this.theme = theme;
    }

    release(document: number) {
        const cached = this.documents.get(document);
        if (cached) {
            this.size -= cached.length;
        }
        this.documents.delete(document);
    }

    highlight(
        document: number,
        id: number,
        base: number | undefined,
        code: string,
        language: string,
    ) {
        const existing = this.documents.get(document);
        const cached = existing?.language === language ? existing : undefined;
        const source = splitLines(code);
        const old = cached?.lines ?? [];
        let first = 0;
        while (first < source.length && source[first]?.[0] === old[first]?.text) {
            first++;
        }
        let suffix = 0;
        while (
            suffix < source.length - first &&
            suffix < old.length - first &&
            source[source.length - suffix - 1]?.[0] === old[old.length - suffix - 1]?.text
        )
        {
            suffix++;
        }

        const lines = old.slice(0, first);
        let state = lines.at(-1)?.state;
        let end = first;
        let tokenizedLines = 0;
        for (let index = first; index < source.length; index++) {
            const previousIndex = index + old.length - source.length;
            if (
                index >= source.length - suffix &&
                sameState(state, old[previousIndex - 1]?.state)
            ) {
                lines.push(...old.slice(previousIndex));
                break;
            }
            const line = source[index];
            if (!line) {
                throw new Error("Missing source line");
            }
            const themed = this.engine.codeToTokensBase(line[0], {
                lang: language,
                theme: this.theme,
                ...(state ? { grammarState: state } : {}),
            });
            state = this.engine.getLastGrammarState(themed);
            const tokens = (themed[0] ?? [])
                .filter((token) => token.content.length > 0)
                .map((token) => ({
                    from: token.offset,
                    to: token.offset + token.content.length,
                    color: token.color ?? "var(--shiki-foreground)",
                    fontStyle: token.fontStyle ?? 0,
                }));
            lines.push({ text: line[0], tokens, state });
            end = index + 1;
            tokenizedLines++;
        }

        // A stale response may have been discarded while the worker kept advancing.
        // In that case re-send cached tokens too, never apply a patch to the wrong base.
        const full = !cached || cached.id !== base;
        const from = full ? 0 : (source[first]?.[1] ?? code.length);
        const to = full ? code.length : (source[end]?.[1] ?? code.length);
        const tokens: HighlightToken[] = [];
        for (let index = full ? 0 : first; index < (full ? lines.length : end); index++) {
            const line = lines[index];
            const offset = source[index]?.[1];
            if (!line || offset === undefined) {
                throw new Error("Missing cached source line");
            }
            for (const token of line.tokens) {
                tokens.push({ ...token, from: token.from + offset, to: token.to + offset });
            }
        }
        this.release(document);
        this.documents.set(document, { id, length: code.length, language, lines });
        this.size += code.length;
        // Bound long notebook sessions; an evicted cell safely starts with a full patch.
        while (this.size > MAX_CODE * 8 || this.documents.size > 128) {
            const oldest = this.documents.keys().next().value;
            if (oldest === undefined) {
                break;
            }
            this.release(oldest);
        }
        return { from, to, tokens, tokenizedLines };
    }
}
