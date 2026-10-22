import type { HighlightRequest, HighlightResponse } from "./contracts.ts";

// Notebook pages can contain a hundred editors. Share one tokenizer for each
// author-controlled grammar set instead of keeping a worker per visible cell.
const pools = new Map<string, { worker: Worker; pending: Map<number, (response: HighlightResponse) => void> }>();
let sequence = 0;
export function sharedHighlight(request: HighlightRequest, receive: (response: HighlightResponse) => void) {
	const key = JSON.stringify(request.grammars);
	let pool = pools.get(key);
	if (!pool) {
		const pending = new Map<number, (response: HighlightResponse) => void>();
		const worker = new Worker(new URL("./highlight.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<HighlightResponse>) => { const done = pending.get(event.data.id); pending.delete(event.data.id); done?.(event.data); };
		worker.onerror = (event) => { event.preventDefault(); for (const [id, done] of pending) done({ id, error: event.message }); pending.clear(); worker.terminate(); pools.delete(key); };
		pool = { worker, pending }; pools.set(key, pool);
	}
	const id = ++sequence;
	pool.pending.set(id, (response) => { receive({ ...response, id: request.id }); });
	pool.worker.postMessage({ ...request, id });
	return () => { pool.pending.delete(id); };
}

document.addEventListener("astro:before-swap", () => { for (const pool of pools.values()) pool.worker.terminate(); pools.clear(); });
