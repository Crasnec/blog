import { createHighlighterCore, createCssVariablesTheme } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import javascript from "shiki/langs/javascript.mjs";
import typescript from "shiki/langs/typescript.mjs";
import python from "shiki/langs/python.mjs";
import { parseGrammars } from "./grammar.ts";
import { runtimeFor, type HighlightRequest, type HighlightResponse } from "./contracts.ts";

const highlighter = createHighlighterCore({
    engine: createOnigurumaEngine(import("shiki/wasm")),
    themes: [createCssVariablesTheme({ name: "blog-editor" })],
    langs: [javascript, typescript, python],
});
let activeGrammars = "";

self.addEventListener("message", (event: MessageEvent<HighlightRequest>) => {
    void highlight(event.data);
});

async function highlight(request: HighlightRequest) {
    let response: HighlightResponse;
    try {
        const engine = await highlighter;
        const fingerprint = JSON.stringify(request.grammars);
        if (fingerprint !== activeGrammars) {
            // Custom grammars may reuse scope names; replacing a grammar starts a
            // fresh worker in the editor, so registrations never leak between sets.
            await engine.loadLanguage(...parseGrammars(request.grammars));
            activeGrammars = fingerprint;
        }
        const lang = request.grammars.length ? "custom-0" : runtimeFor(request.language) || "text";
        const lines = engine.codeToTokensBase(request.code, { lang, theme: "blog-editor" });
        response = {
            id: request.id,
            name: request.grammars[0]?.filename ?? request.language,
            tokens: lines.flatMap((line) =>
                line
                    .filter((token) => token.content.length > 0)
                    .map((token) => ({
                        from: token.offset,
                        to: token.offset + token.content.length,
                        color: token.color ?? "var(--shiki-foreground)",
                        fontStyle: token.fontStyle ?? 0,
                    })),
            ),
        };
    } catch (error) {
        response = {
            id: request.id,
            error: error instanceof Error ? error.message : String(error),
        };
    }
    self.postMessage(response);
}
