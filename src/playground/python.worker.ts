import type * as Pyodide from "pyodide";
import { t } from "../strings.ts";
import { MAX_CODE, type InputResponse, type CellRequest, type RunRequest, type RunResponse } from "./contracts.ts";
import { parseJson } from "../utils/json.ts";
import { inputChannel, installPythonInput } from "./input.ts";
import { outputChannel } from "./output.ts";
import { installPlotCapture, installWarningCapture, pngFromBase64 } from "./python-plots.ts";
import { installNotebookDisplay } from "./python-display.ts";

self.addEventListener("message", (event: MessageEvent<RunRequest>) => { void start(event.data); }, { once: true });

async function start(request: RunRequest) {
	let emit = outputChannel(request.port);
	const send = (message: RunResponse) => { emit(message); };
	try {
		const url = new URL("pyodide.mjs", request.assets).href;
		const { loadPyodide } = await import(/* @vite-ignore */ url) as Pick<typeof Pyodide, "loadPyodide">;
		const python = await loadPyodide({
			indexURL: request.assets, packageBaseUrl: request.assets,
			stdin: () => { throw new Error(t("playground.stdinUnavailable")); },
			stdout: (text) => { send({ type: "output", level: "log", text }); },
			stderr: (text) => { send({ type: "output", level: "error", text }); },
		});
		const source = { code: "", requirements: "[]" };
		python.registerJsModule("_playground", {
			source,
			request_input: inputChannel(request.port, send), input_unsupported: t("playground.inputUnsupported"),
			emit_png: (encoded: string, title: string) => { send({ type: "plot", png: pngFromBase64(encoded), alt: typeof title === "string" ? title.slice(0, 300) : "Matplotlib figure" }); },
			emit_warning: (text: string) => { send({ type: "output", level: "warn", text }); },
		});
		python.runPython(installWarningCapture);
		python.runPython(installPythonInput);
		let plots = false;
		let busy = false;
		async function execute(cell: Pick<CellRequest, "code" | "pythonPackages">) {
			if (busy) return;
			busy = true;
			emit = outputChannel(request.port);
			try {
				if (typeof cell.code !== "string" || cell.code.length > MAX_CODE) throw new Error("Invalid notebook cell source");
				source.code = cell.code;
				python.runPython("from _playground import source as __pg_bridge\n__pg_source = __pg_bridge.code");
				const imported = parseJson(python.runPython('import json as __pg_json\nfrom pyodide.code import find_imports as __pg_find_imports\n__pg_json.dumps(__pg_find_imports(__pg_source))') as string);
				if (!Array.isArray(imported)) throw new Error("Could not inspect Python imports");
				const options = { checkIntegrity: true, messageCallback: () => { /* Preserve the localized status. */ }, errorCallback: (text: string) => { send({ type: "output", level: "warn", text }); } };
				const packages = [...new Set([...cell.pythonPackages, ...imported.filter((name): name is string => typeof name === "string")])];
				if (packages.length) send({ type: "status", text: t("playground.packagesLoading", { packages: packages.join(", ") }) });
				if (cell.pythonPackages.length) {
					await python.loadPackage("micropip", options);
					source.requirements = JSON.stringify(cell.pythonPackages);
					await python.runPythonAsync("import micropip as __pg_micropip\nawait __pg_micropip.install(__pg_json.loads(__pg_bridge.requirements))");
				}
				await python.loadPackagesFromImports(cell.code, options);
				if (!plots && Object.hasOwn(python.loadedPackages, "matplotlib")) {
					python.runPython(installPlotCapture); plots = true;
				}
				if (request.persistent) python.runPython(installNotebookDisplay);
				send({ type: "ready" });
				await python.runPythonAsync(request.persistent ? "await __nb_run_cell(__pg_source)" : cell.code);
				if (plots) python.runPython("__playground_flush_plots()");
				send({ type: "done" });
			} catch (error) {
				if (plots) python.runPython("__pg_plt.close('all')");
				send({ type: "error", text: error instanceof Error ? error.message : String(error) });
			} finally { busy = false; }
		}
		if (request.persistent) request.port.addEventListener("message", (event: MessageEvent<CellRequest | InputResponse>) => { if (event.data.type === "run") void execute(event.data); });
		await execute(request);
	} catch (error) { send({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
}
