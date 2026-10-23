import type {
    MessageValue,
    HighlightRequest,
    GrammarSource,
    HighlightResponse,
    HighlightToken,
} from "./types.ts";
import { isRecord, isId, isArray } from "./readers.ts";
import { MAX_CODE, MAX_GRAMMAR } from "./limits.ts";

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
    ) {
        return;
    }
    const grammars: GrammarSource[] = [];
    let length = 0;
    for (const grammar of value.grammars ?? []) {
        if (
            !isRecord(grammar) ||
            typeof grammar.filename !== "string" ||
            typeof grammar.content !== "string"
        ) {
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
    if (
        typeof value.name !== "string" ||
        !isArray(value.tokens) ||
        value.tokens.length > MAX_CODE
    ) {
        return;
    }
    const ranged = value.from !== undefined || value.to !== undefined;
    if (
        ranged &&
        (!isId(value.from) || !isId(value.to) || value.from > value.to || value.to > MAX_CODE)
    ) {
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
        ) {
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
