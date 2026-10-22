import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { HighlightToken } from "./contracts.ts";

export interface TokenPatch {
    from: number;
    to: number;
    tokens: HighlightToken[];
}

export const setTokens = StateEffect.define<TokenPatch>();
export const highlights = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(value, transaction) {
        // Keep existing colours attached to their text while the worker catches up.
        if (transaction.docChanged) value = value.map(transaction.changes);
        for (const effect of transaction.effects) {
            if (!effect.is(setTokens)) continue;
            const patch = effect.value;
            value = value.update({
                filterFrom: patch.from,
                filterTo: patch.to,
                filter: (from, to) => to <= patch.from || from >= patch.to,
                add: patch.tokens.map((token) => {
                    const style = `color:${token.color};${token.fontStyle & 1 ? "font-style:italic;" : ""}${token.fontStyle & 2 ? "font-weight:bold;" : ""}${token.fontStyle & 4 ? "text-decoration:underline;" : ""}`;
                    return Decoration.mark({
                        attributes: { style, "data-textmate-token": "" },
                    }).range(token.from, token.to);
                }),
                sort: true,
            });
        }
        return value;
    },
    provide: (field) => EditorView.decorations.from(field),
});
