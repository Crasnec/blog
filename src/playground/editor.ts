import { basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, keymap, type DecorationSet } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { LOCALE, t } from "../strings.ts";
import { editorPhrases } from "../locales/editor.ts";
import {
    MAX_CODE,
    type HighlightRequest,
    type HighlightResponse,
    type HighlightToken,
    type PlaygroundConfig,
} from "./contracts.ts";

import { sharedHighlight } from "./shared-highlight.ts";

const setTokens = StateEffect.define<HighlightToken[]>();
const highlights = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(value, transaction) {
        if (transaction.docChanged) value = Decoration.none;
        for (const effect of transaction.effects) {
            if (!effect.is(setTokens)) continue;
            value = Decoration.set(
                effect.value.map((token) => {
                    const style = `color:${token.color};${token.fontStyle & 1 ? "font-style:italic;" : ""}${token.fontStyle & 2 ? "font-weight:bold;" : ""}${token.fontStyle & 4 ? "text-decoration:underline;" : ""}`;
                    return Decoration.mark({
                        attributes: { style, "data-textmate-token": "" },
                    }).range(token.from, token.to);
                }),
                true,
            );
        }
        return value;
    },
    provide: (field) => EditorView.decorations.from(field),
});

function required<T extends Element>(element: T | null): T {
    if (!element) throw new Error("Incomplete code editor markup");
    return element;
}

export function mountEditor(
    root: HTMLElement,
    config: PlaygroundConfig,
    run: () => void,
    changed: () => void = () => {
        /* Standalone editors have no dependents. */
    },
) {
    const parent = required(root.querySelector<HTMLElement>(".playground-editor"));
    const fallback = required(root.querySelector<HTMLTextAreaElement>("textarea"));
    const note = required(root.querySelector<HTMLElement>(".playground-highlight-status"));
    const original = fallback.value;
    const grammars = config.grammars;
    let worker: Worker | undefined;
    let cancelShared: (() => void) | undefined;
    let version = 0;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let busy = false;
    let queued = false;
    let blocked = false;
    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc: original,
            extensions: [
                basicSetup,
                highlights,
                EditorView.lineWrapping,
                EditorState.phrases.of(editorPhrases[LOCALE]),
                EditorView.contentAttributes.of({
                    "aria-label": `${config.label}: ${t("playground.code")}`,
                    spellcheck: "false",
                }),
                EditorState.transactionFilter.of((transaction) =>
                    transaction.newDoc.length > MAX_CODE ? [] : transaction,
                ),
                keymap.of([
                    {
                        key: "Mod-Enter",
                        run: () => {
                            run();
                            return true;
                        },
                    },
                    indentWithTab,
                ]),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        changed();
                        schedule();
                    }
                }),
            ],
        }),
    });
    fallback.hidden = true;

    function stopHighlight() {
        worker?.terminate();
        worker = undefined;
        cancelShared?.();
        cancelShared = undefined;
        clearTimeout(watchdog);
        busy = false;
    }
    function fail(message: string) {
        stopHighlight();
        blocked = true;
        note.textContent = `${t("playground.highlightError")} ${message}`;
        note.hidden = false;
        root.dataset.highlight = "error";
    }
    function schedule() {
        ++version;
        clearTimeout(debounce);
        debounce = setTimeout(highlight, 120);
    }
    function highlight() {
        if (disposed || blocked) return;
        if (busy) {
            queued = true;
            return;
        }
        if (config.notebook) {
            busy = true;
            watchdog = setTimeout(() => {
                fail(t("playground.highlightTimeout"));
            }, 15_000);
            const request: HighlightRequest = {
                id: version,
                code: view.state.doc.toString(),
                language: config.language,
                grammars,
            };
            cancelShared = sharedHighlight(request, (response) => {
                clearTimeout(watchdog);
                busy = false;
                if (response.id === version) {
                    if ("error" in response) {
                        fail(response.error);
                        return;
                    }
                    view.dispatch({ effects: setTokens.of(response.tokens) });
                    root.dataset.highlight = "ready";
                }
                if (queued) {
                    queued = false;
                    highlight();
                }
            });
            return;
        }
        if (!worker) {
            worker = new Worker(new URL("./highlight.worker.ts", import.meta.url), {
                type: "module",
            });
            worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
                clearTimeout(watchdog);
                busy = false;
                const response = event.data;
                if (response.id === version) {
                    if ("error" in response) {
                        fail(response.error);
                        return;
                    }
                    view.dispatch({ effects: setTokens.of(response.tokens) });
                    note.textContent = "";
                    note.hidden = true;
                    root.dataset.highlight = "ready";
                }
                if (queued) {
                    queued = false;
                    highlight();
                }
            };
            worker.onerror = (event) => {
                event.preventDefault();
                fail(event.message);
            };
        }
        busy = true;
        watchdog = setTimeout(() => {
            fail(t("playground.highlightTimeout"));
        }, 15_000);
        const request: HighlightRequest = {
            id: version,
            code: view.state.doc.toString(),
            language: config.language,
            grammars,
        };
        worker.postMessage(request);
    }

    schedule();
    return {
        code: () => view.state.doc.toString(),
        focus: () => {
            view.focus();
        },
        reset: () => {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } });
        },
        destroy: () => {
            disposed = true;
            clearTimeout(debounce);
            stopHighlight();
            view.destroy();
        },
    };
}
