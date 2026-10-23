import { createHighlighterCore, createCssVariablesTheme } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import javascript from "shiki/langs/javascript.mjs";
import typescript from "shiki/langs/typescript.mjs";
import python from "shiki/langs/python.mjs";
import { parseGrammars } from "#src/playground/grammar.ts";
import { IncrementalHighlighter } from "#src/playground/incremental-highlight.ts";
import {
    runtimeFor,
    decodeHighlightRequest,
    decodeHighlightRelease,
    type MessageValue,
    type HighlightRequest,
    type HighlightResponse,
} from "#src/playground/contracts.ts";

const highlighter = createHighlighterCore({
    engine: createOnigurumaEngine(import("shiki/wasm")),
    themes: [createCssVariablesTheme({ name: "blog-editor" })],
    langs: [javascript, typescript, python],
});
let activeGrammars = "";
let customName: string | undefined;
let incremental: IncrementalHighlighter | undefined;
let pending = Promise.resolve();
const released = new Set<number>();

self.addEventListener("message", (event: MessageEvent<MessageValue>) => {
    const document = decodeHighlightRelease(event.data);
    if (document !== undefined) {
        released.add(document);
        incremental?.release(document);
        return;
    }
    const request = decodeHighlightRequest(event.data);
    // Language registration is async. Serialize requests so a shared worker's
    // first cells cannot tokenize before their author grammar finishes loading.
    if (request) {
        pending = pending.then(() => highlight(request));
    }
});

async function highlight(request: HighlightRequest) {
    const document = request.document ?? 0;
    if (released.has(document)) {
        return;
    }
    let response: HighlightResponse;
    try {
        const engine = await highlighter;
        const fingerprint = request.grammars ? JSON.stringify(request.grammars) : activeGrammars;
        if (request.grammars && fingerprint !== activeGrammars) {
            // Custom grammars may reuse scope names; replacing a grammar starts a
            // fresh worker in the editor, so registrations never leak between sets.
            await engine.loadLanguage(...parseGrammars(request.grammars));
            activeGrammars = fingerprint;
            customName = request.grammars[0]?.filename;
            incremental = undefined;
        }
        if (released.has(document)) {
            return;
        }
        const lang = customName !== undefined ? "custom-0" : runtimeFor(request.language) || "text";
        incremental ??= new IncrementalHighlighter(engine, "blog-editor");
        const { from, to, tokens } = incremental.highlight(
            document,
            request.revision ?? request.id,
            request.base,
            request.code,
            lang,
        );
        response = {
            id: request.id,
            name: customName ?? request.language,
            from,
            to,
            tokens,
        };
    } catch (error) {
        response = {
            id: request.id,
            error: error instanceof Error ? error.message : String(error),
        };
    }
    self.postMessage(response);
}
