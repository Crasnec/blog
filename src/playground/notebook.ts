import { t } from "#src/strings.ts";
import {
    decodeRunResponse,
    type MessageValue,
    type CellRequest,
    type InputResponse,
    type PythonPackage,
    type RunRequest,
    type RunResponse,
} from "#src/playground/contracts.ts";

export interface NotebookCell {
    root: HTMLElement;
    code: () => string;
    run: () => Promise<boolean>;
    cancel: () => void;
}

/** One private worker/namespace per author-declared notebook; one active cell. */
export class PythonNotebook {
    readonly cells: NotebookCell[] = [];
    private worker: Worker | undefined;
    private port: MessagePort | undefined;
    private active: { cell: NotebookCell; receive: (response: RunResponse) => void } | undefined;
    private sequence = 0;
    private batch = false;
    private generation = 0;
    private readonly toolbar: HTMLElement | null;
    constructor(readonly id: string) {
        this.toolbar = document.querySelector<HTMLElement>(`[data-python-notebook="${id}"]`);
        this.toolbar?.querySelector(".notebook-run-all")?.addEventListener("click", () => {
            void this.runAll();
        });
        this.toolbar?.querySelector(".notebook-restart")?.addEventListener("click", () => {
            this.restart();
        });
        this.toolbar?.querySelector(".notebook-download")?.addEventListener("click", () => {
            this.download();
        });
    }

    add(cell: NotebookCell) {
        this.cells.push(cell);
        this.buttons();
    }

    private status(message: string) {
        const el = this.toolbar?.querySelector(".notebook-status");
        if (el) {
            el.textContent = message;
        }
    }

    private buttons() {
        for (const cell of this.cells) {
            for (const button of cell.root.querySelectorAll<HTMLButtonElement>(
                ".playground-run, .playground-reset",
            ))
            {
                button.disabled = !!this.active || this.batch;
            }
        }
        for (const button of this.toolbar?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        {
            button.disabled = button.classList.contains("notebook-restart")
                ? false
                : !!this.active || this.batch;
        }
    }

    changed(root: HTMLElement, edited = true) {
        const index = this.cells.findIndex((cell) => cell.root === root);
        for (const cell of this.cells.slice(index + (edited ? 0 : 1))) {
            if (!cell.root.dataset.executed) {
                continue;
            }
            const notice = cell.root.querySelector<HTMLElement>(".notebook-stale");
            if (notice) {
                notice.hidden = false;
            }
        }
    }

    start(
        cell: NotebookCell,
        code: string,
        pythonPackages: PythonPackage[],
        assets: string,
        receive: (response: RunResponse) => void,
    ): MessagePort | undefined {
        if (this.active) {
            return undefined;
        }
        this.changed(cell.root, false);
        this.active = { cell, receive };
        this.buttons();
        if (!this.batch) {
            this.status(t("playground.loading"));
        }
        try {
            if (!this.worker || !this.port) {
                this.worker = new Worker(new URL("./python.worker.ts", import.meta.url), {
                    type: "module",
                });
                const channel = new MessageChannel();
                this.port = channel.port1;
                this.port.onmessage = (event: MessageEvent<MessageValue>) => {
                    const response = decodeRunResponse(event.data);
                    if (response) {
                        this.message(response);
                    }
                };

                this.worker.onerror = (event) => {
                    event.preventDefault();
                    const active = this.active;
                    this.restart(false);
                    active?.receive({ type: "error", text: event.message });
                };
                const request: RunRequest = {
                    code,
                    pythonPackages,
                    assets,
                    runtime: "python",
                    persistent: true,
                    port: channel.port2,
                };
                this.worker.postMessage(request, [channel.port2]);
            } else {
                const request: CellRequest = { type: "run", code, pythonPackages };
                this.port.postMessage(request);
            }
            return this.port;
        } catch (error) {
            this.message({
                type: "error",
                text: error instanceof Error ? error.message : String(error),
            });
        }
        return undefined;
    }

    private message(response: RunResponse) {
        const active = this.active;
        if (!active) {
            return;
        }
        if (response.type === "ready") {
            active.cell.root.dataset.executed = "true";
            const count = active.cell.root.querySelector(".notebook-execution");
            if (count) {
                count.textContent = `[${String(++this.sequence)}]`;
            }
            const stale = active.cell.root.querySelector<HTMLElement>(".notebook-stale");
            if (stale) {
                stale.hidden = true;
            }
        }
        if (response.type === "done" || response.type === "error") {
            this.active = undefined;
        }
        active.receive(response);
        if (!this.batch && (response.type === "done" || response.type === "error"))
        {
            this.status(t(response.type === "done" ? "playground.done" : "playground.failed"));
        }
        this.buttons();
    }

    input(response: InputResponse) {
        this.port?.postMessage(response);
    }

    restart(notify = true) {
        ++this.generation;
        this.batch = false;
        const active = this.active;
        this.active = undefined;
        this.worker?.terminate();
        this.worker = undefined;
        this.port?.close();
        this.port = undefined;
        this.sequence = 0;
        active?.cell.cancel();
        for (const cell of this.cells) {
            const count = cell.root.querySelector(".notebook-execution");
            if (count) {
                count.textContent = "[ ]";
            }
            const notice = cell.root.querySelector<HTMLElement>(".notebook-stale");
            if (notice) {
                notice.hidden = !cell.root.dataset.executed;
            }
        }
        this.buttons();
        if (notify) {
            this.status(t("notebook.resetNotice"));
        }
    }

    async runAll() {
        if (this.active || this.batch) {
            return;
        }
        const generation = this.generation;
        this.batch = true;
        this.buttons();
        const cells = this.cells.filter((cell) => cell.root.dataset.runAll !== "false");
        for (const [index, cell] of cells.entries()) {
            if (generation !== this.generation) {
                return;
            }
            this.status(t("notebook.progress", { current: index + 1, total: cells.length }));
            const success = await cell.run();
            if (generation !== this.generation) {
                return;
            }
            if (!success) {
                this.batch = false;
                this.buttons();
                this.status(t("notebook.failed"));
                return;
            }
        }
        this.batch = false;
        this.buttons();
        this.status(t("playground.done"));
    }

    private download() {
        const title = document.querySelector("h1")?.textContent ?? this.id;
        const notebook = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
                kernelspec: {
                    display_name: "Python 3 (Pyodide)",
                    language: "python",
                    name: "python3",
                },
                source: location.href,
            },
            cells: [
                {
                    cell_type: "markdown",
                    id: "source",
                    metadata: {},
                    source: [
                        `# ${title}\n\n`,
                        `Edited code from ${location.href}\n\n${this.toolbar?.dataset.attribution ?? ""}`,
                    ],
                },
                ...this.cells.map((cell, index) => ({
                    cell_type: "code",
                    id: `cell-${String(index + 1)}`,
                    metadata: {},
                    execution_count: null,
                    outputs: [],
                    source: cell
                        .code()
                        .replace(
                            /^(DATA_URL[ \t]*=[ \t]*)(["'])(\/[^"'\r\n]*)\2/gmu,
                            (_match: string, assignment: string, _quote: string, path: string) =>
                                `${assignment}${JSON.stringify(new URL(path, location.origin).href)}`,
                        )
                        .split(/(?<=\n)/u),
                })),
            ],
        };
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(notebook, null, 1)], { type: "application/x-ipynb+json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${this.id}-edited.ipynb`;
        link.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }
}
