import { basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, keymap, type DecorationSet } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { t } from "../strings.ts";
import { MAX_CODE, MAX_GRAMMAR, type GrammarSource, type HighlightRequest, type HighlightResponse, type HighlightToken, type PlaygroundConfig } from "./contracts.ts";

const setTokens = StateEffect.define<HighlightToken[]>();
const highlights = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, transaction) {
		if (transaction.docChanged) value = Decoration.none;
		for (const effect of transaction.effects) {
			if (!effect.is(setTokens)) continue;
			value = Decoration.set(effect.value.map((token) => {
				const style = `color:${token.color};${token.fontStyle & 1 ? "font-style:italic;" : ""}${token.fontStyle & 2 ? "font-weight:bold;" : ""}${token.fontStyle & 4 ? "text-decoration:underline;" : ""}`;
				return Decoration.mark({ attributes: { style, "data-textmate-token": "" } }).range(token.from, token.to);
			}), true);
		}
		return value;
	},
	provide: (field) => EditorView.decorations.from(field),
});

function required<T extends Element>(element: T | null): T {
	if (!element) throw new Error("Incomplete code editor markup");
	return element;
}

export function mountEditor(root: HTMLElement, config: PlaygroundConfig, run: () => void) {
	const parent = required(root.querySelector<HTMLElement>(".playground-editor"));
	const fallback = required(root.querySelector<HTMLTextAreaElement>("textarea"));
	const note = required(root.querySelector<HTMLElement>(".playground-grammar-status"));
	const upload = required(root.querySelector<HTMLInputElement>(".playground-grammar-file"));
	const reset = required(root.querySelector<HTMLButtonElement>(".playground-grammar-reset"));
	const original = fallback.value;
	let grammars = config.grammars;
	let worker: Worker | undefined;
	let version = 0;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let watchdog: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	let busy = false;
	let queued = false;
	let blocked = false;
	let uploadVersion = 0;
	const view = new EditorView({
		parent,
		state: EditorState.create({
			doc: original,
			extensions: [basicSetup, highlights, EditorView.lineWrapping,
				EditorView.contentAttributes.of({ "aria-label": `${config.label}: ${t("playground.code")}`, spellcheck: "false" }),
				EditorState.transactionFilter.of((transaction) => transaction.newDoc.length > MAX_CODE ? [] : transaction),
				keymap.of([{ key: "Mod-Enter", run: () => { run(); return true; } }, indentWithTab]),
				EditorView.updateListener.of((update) => { if (update.docChanged) schedule(); }),
			],
		}),
	});
	fallback.hidden = true;

	function stopHighlight() {
		worker?.terminate(); worker = undefined;
		clearTimeout(watchdog); busy = false;
	}
	function fail(message: string) {
		stopHighlight(); blocked = true;
		note.textContent = `${t("playground.grammarError")} ${message}`;
		root.dataset.highlight = "error";
	}
	function schedule() {
		++version;
		clearTimeout(debounce);
		debounce = setTimeout(highlight, 120);
	}
	function highlight() {
		if (disposed || blocked) return;
		if (busy) { queued = true; return; }
		if (!worker) {
			worker = new Worker(new URL("./highlight.worker.ts", import.meta.url), { type: "module" });
			worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
				clearTimeout(watchdog); busy = false;
				const response = event.data;
				if (response.id === version) {
					if ("error" in response) { fail(response.error); return; }
					view.dispatch({ effects: setTokens.of(response.tokens) });
					note.textContent = `${t("playground.grammarActive")} ${response.name}`;
					root.dataset.highlight = "ready";
				}
				if (queued) { queued = false; highlight(); }
			};
			worker.onerror = (event) => { event.preventDefault(); fail(event.message); };
		}
		busy = true;
		watchdog = setTimeout(() => { fail(t("playground.grammarTimeout")); }, 15_000);
		const request: HighlightRequest = { id: version, code: view.state.doc.toString(), language: config.language, grammars };
		worker.postMessage(request);
	}
	function replaceGrammars(sources: GrammarSource[]) {
		stopHighlight(); blocked = false; queued = false;
		grammars = sources;
		view.dispatch({ effects: setTokens.of([]) });
		note.textContent = t("playground.grammarLoading");
		schedule();
	}
	async function loadFiles() {
		const mine = ++uploadVersion;
		try {
			const files = [...(upload.files ?? [])];
			if (!files.length) return;
			if (files.length > 16 || files.reduce((sum, file) => sum + file.size, 0) > MAX_GRAMMAR) throw new Error("Provide at most 16 grammar files totalling 1 MB");
			const sources = await Promise.all(files.map(async (file) => ({ filename: file.name, content: await file.text() })));
			if (mine === uploadVersion && !disposed) replaceGrammars(sources);
		} catch (error) {
			if (mine === uploadVersion && !disposed) note.textContent = `${t("playground.grammarError")} ${error instanceof Error ? error.message : String(error)}`;
		}
	}
	upload.addEventListener("change", () => { void loadFiles(); });
	reset.disabled = false;
	reset.addEventListener("click", () => { ++uploadVersion; upload.value = ""; replaceGrammars(config.grammars); });
	schedule();
	return {
		code: () => view.state.doc.toString(),
		reset: () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } }); },
		destroy: () => { disposed = true; ++uploadVersion; clearTimeout(debounce); stopHighlight(); view.destroy(); },
	};
}
