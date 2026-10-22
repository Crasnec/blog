import {
    decodeHighlightResponse,
    type MessageValue,
    type HighlightRequest,
    type HighlightResponse,
    type GrammarSource,
} from "./contracts.ts";

// Share one tokenizer per author grammar set across standalone and notebook cells.
// A document ID keeps incremental grammar state separate for every editor.
const pools = new Map<
    string,
    {
        worker: Worker;
        pending: Map<number, (response: HighlightResponse) => void>;
        initialized: boolean;
    }
>();
const grammarKeys = new WeakMap<GrammarSource[], string>();
function grammarKey(grammars: GrammarSource[]): string {
    let key = grammarKeys.get(grammars);
    if (key === undefined) {
        key = JSON.stringify(grammars);
        grammarKeys.set(grammars, key);
    }
    return key;
}
let sequence = 0;
export function sharedHighlight(
    request: HighlightRequest,
    receive: (response: HighlightResponse) => void,
) {
    const key = request.grammars ? grammarKey(request.grammars) : "[]";
    let pool = pools.get(key);
    if (!pool) {
        const pending = new Map<number, (response: HighlightResponse) => void>();
        const worker = new Worker(new URL("./highlight.worker.ts", import.meta.url), {
            type: "module",
        });
        const fail = (message: string) => {
            if (pools.get(key)?.worker !== worker) {
                return;
            }
            worker.terminate();
            pools.delete(key);
            for (const [id, done] of pending) {
                done({ id, error: message });
            }
            pending.clear();
        };

        worker.onmessage = (event: MessageEvent<MessageValue>) => {
            const response = decodeHighlightResponse(event.data);
            if (!response) {
                fail("Invalid syntax highlighting response");
                return;
            }
            const done = pending.get(response.id);
            pending.delete(response.id);
            done?.(response);
        };

        worker.onerror = (event) => {
            event.preventDefault();
            fail(event.message);
        };
        pool = { worker, pending, initialized: false };
        pools.set(key, pool);
    }
    const id = ++sequence;
    pool.pending.set(id, (response) => {
        receive({ ...response, id: request.id });
    });
    const { grammars, ...message } = request;
    pool.worker.postMessage({ ...message, id, ...(!pool.initialized ? { grammars } : {}) });
    pool.initialized = true;
    return (terminate = false) => {
        pool.pending.delete(id);
        if (terminate && pools.get(key) === pool) {
            pool.worker.terminate();
            pools.delete(key);
            for (const [pendingId, done] of pool.pending) {
                done({ id: pendingId, error: "Syntax highlighting worker stopped" });
            }
            pool.pending.clear();
        }
    };
}

export function releaseHighlight(document: number, grammars: GrammarSource[]) {
    pools.get(grammarKey(grammars))?.worker.postMessage({ type: "release", document });
}

document.addEventListener("astro:before-swap", () => {
    for (const pool of pools.values()) {
        pool.worker.terminate();
    }
    pools.clear();
});
