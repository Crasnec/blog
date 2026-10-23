import { basicSetup } from "codemirror";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { LOCALE, t } from "#src/strings.ts";
import { editorPhrases } from "#src/locales/editor.ts";
import { MAX_CODE, type HighlightRequest, type PlaygroundConfig } from "#src/playground/contracts.ts";

import { releaseHighlight, sharedHighlight } from "#src/playground/shared-highlight.ts";
import { highlights, setTokens } from "#src/playground/highlight-decorations.ts";

let nextDocument = 0;

function required<T extends Element>(element: T | null): T {
    if (!element) {
        throw new Error("Incomplete code editor markup");
    }
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
    const document = ++nextDocument;
    let cancelShared: ((terminate?: boolean) => void) | undefined;
    let version = 0;
    let appliedVersion: number | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let busy = false;
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
                // Override the default Mod-Enter binding that inserts a blank line.
                Prec.high(
                    keymap.of([
                        {
                            key: "Mod-Enter",
                            run: () => {
                                run();
                                return true;
                            },
                        },
                    ]),
                ),
                keymap.of([indentWithTab]),
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

    function stopHighlight(terminate = false) {
        cancelShared?.(terminate);
        cancelShared = undefined;
        clearTimeout(watchdog);
        busy = false;
    }

    function fail(message: string) {
        if (disposed || blocked) {
            return;
        }
        blocked = true;
        stopHighlight(true);
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
        if (disposed || blocked || busy) {
            return;
        }
        busy = true;
        watchdog = setTimeout(() => {
            fail(t("playground.highlightTimeout"));
        }, 15_000);
        const request: HighlightRequest = {
            id: version,
            revision: version,
            document,
            ...(appliedVersion !== undefined ? { base: appliedVersion } : {}),
            code: view.state.doc.toString(),
            language: config.language,
            grammars,
        };
        cancelShared = sharedHighlight(request, (response) => {
            clearTimeout(watchdog);
            busy = false;
            if (disposed) {
                return;
            }
            if (response.id === version) {
                if ("error" in response) {
                    fail(response.error);
                    return;
                }
                const from = response.from ?? 0;
                const to = response.to ?? view.state.doc.length;
                if (to > view.state.doc.length || response.tokens.some((token) => token.to > to)) {
                    fail("Syntax highlighting range exceeds the source");
                    return;
                }
                view.dispatch({ effects: setTokens.of({ from, to, tokens: response.tokens }) });
                appliedVersion = response.id;
                note.textContent = "";
                note.hidden = true;
                root.dataset.highlight = "ready";
            } else {
                // The pending request covered an older revision. Coalesce further
                // typing before sending the latest one, with the last applied base.
                clearTimeout(debounce);
                debounce = setTimeout(highlight, 120);
            }
        });
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
            releaseHighlight(document, grammars);
            view.destroy();
        },
    };
}
