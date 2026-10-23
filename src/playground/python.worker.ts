import { t } from "#src/strings.ts";
import {
    MAX_CODE,
    decodeRunRequest,
    decodeCellRequest,
    type MessageValue,
    type CellRequest,
    type RunRequest,
    type RunResponse,
} from "#src/playground/contracts.ts";
import { parseJson } from "#src/utils/json.ts";
import { inputChannel, installPythonInput } from "#src/playground/input.ts";
import { formatValue, outputChannel } from "#src/playground/output.ts";
import { installPlotCapture, installWarningCapture, pngFromBase64 } from "#src/playground/python-plots.ts";
import { installNotebookDisplay } from "#src/playground/python-display.ts";
import { initializePythonRuntime } from "#src/playground/python-runtime.ts";

self.addEventListener(
    "message",
    (event: MessageEvent<MessageValue>) => {
        const request = decodeRunRequest(event.data);
        if (request) {
            void start(request);
        }
    },
    { once: true },
);

async function start(request: RunRequest) {
    let emit = outputChannel(request.port);
    const send = (message: RunResponse) => {
        emit(message);
    };
    try {
        const url = new URL("pyodide.mjs", request.assets).href;
        // ECMAScript guarantees a module namespace object; its members are decoded below.
        const module = (await import(/* @vite-ignore */ url)) as object;
        const python = await initializePythonRuntime(module, {
            indexURL: request.assets,
            packageBaseUrl: request.assets,
            stdin: () => {
                throw new Error(t("playground.stdinUnavailable"));
            },
            stdout: (text) => {
                send({ type: "output", level: "log", text });
            },
            stderr: (text) => {
                send({ type: "output", level: "error", text });
            },
        });
        const source = { code: "", requirements: "[]" };
        python.registerJsModule("_playground", {
            source,
            request_input: inputChannel(request.port, send),
            input_unsupported: t("playground.inputUnsupported"),
            emit_png: (encoded: MessageValue, title: MessageValue) => {
                if (typeof encoded !== "string") {
                    throw new Error("Plot output must be PNG text");
                }
                send({
                    type: "plot",
                    png: pngFromBase64(encoded),
                    alt: typeof title === "string" ? title.slice(0, 300) : "Matplotlib figure",
                });
            },
            emit_warning: (text: MessageValue) => {
                send({ type: "output", level: "warn", text: formatValue(text) });
            },
        });
        python.runPython(installWarningCapture);
        python.runPython(installPythonInput);
        let plots = false;
        let busy = false;
        async function execute(cell: Pick<CellRequest, "code" | "pythonPackages">) {
            if (busy) {
                return;
            }
            busy = true;
            emit = outputChannel(request.port);
            try {
                if (typeof cell.code !== "string" || cell.code.length > MAX_CODE)
                {
                    throw new Error("Invalid notebook cell source");
                }
                source.code = cell.code;
                python.runPython(
                    "from _playground import source as __pg_bridge\n__pg_source = __pg_bridge.code",
                );
                const imported = parseJson(
                    python.runPythonString(
                        "import json as __pg_json\nfrom pyodide.code import find_imports as __pg_find_imports\n__pg_json.dumps(__pg_find_imports(__pg_source))",
                    ),
                );
                if (!Array.isArray(imported)) {
                    throw new Error("Could not inspect Python imports");
                }
                const options = {
                    checkIntegrity: true,
                    messageCallback: () => {
                        /* Preserve the localized status. */
                    },
                    errorCallback: (text: string) => {
                        send({ type: "output", level: "warn", text });
                    },
                };
                const packages = [
                    ...new Set([
                        ...cell.pythonPackages,
                        ...imported.filter((name): name is string => typeof name === "string"),
                    ]),
                ];
                if (packages.length)
                {
                    send({
                        type: "status",
                        text: t("playground.packagesLoading", { packages: packages.join(", ") }),
                    });
                }
                if (cell.pythonPackages.length) {
                    await python.loadPackage("micropip", options);
                    source.requirements = JSON.stringify(cell.pythonPackages);
                    await python.runPythonAsync(
                        "import micropip as __pg_micropip\nawait __pg_micropip.install(__pg_json.loads(__pg_bridge.requirements))",
                    );
                }
                await python.loadPackagesFromImports(cell.code, options);
                if (!plots && python.isPackageLoaded("matplotlib")) {
                    python.runPython(installPlotCapture);
                    plots = true;
                }
                if (request.persistent) {
                    python.runPython(installNotebookDisplay);
                }
                send({ type: "ready" });
                await python.runPythonAsync(
                    request.persistent ? "await __nb_run_cell(__pg_source)" : cell.code,
                );
                if (plots) {
                    python.runPython("__playground_flush_plots()");
                }
                send({ type: "done" });
            } catch (error) {
                if (plots) {
                    python.runPython("__pg_plt.close('all')");
                }
                send({
                    type: "error",
                    text: error instanceof Error ? error.message : String(error),
                });
            } finally {
                busy = false;
            }
        }
        if (request.persistent)
        {
            request.port.addEventListener("message", (event: MessageEvent<MessageValue>) => {
                const cell = decodeCellRequest(event.data);
                if (cell) {
                    void execute(cell);
                }
            });
        }
        await execute(request);
    } catch (error) {
        send({ type: "error", text: error instanceof Error ? error.message : String(error) });
    }
}
