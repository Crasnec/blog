import type * as Pyodide from "pyodide";
import { t } from "../strings.ts";
import type { RunRequest } from "./contracts.ts";
import { isPythonPackage } from "./contracts.ts";
import { parseJson } from "../utils/json.ts";
import { outputChannel } from "./output.ts";
import { installPlotCapture, installWarningCapture, pngFromBase64 } from "./python-plots.ts";

self.addEventListener("message", (event: MessageEvent<RunRequest>) => { void run(event.data); }, { once: true });

async function run(request: RunRequest) {
	const send = outputChannel(request.port);
	try {
		// Load the pinned, self-hosted browser module directly; bundling its
		// Node.js branches would add unusable server-module shims to the worker.
		const url = new URL("pyodide.mjs", request.assets).href;
		const { loadPyodide } = await import(/* @vite-ignore */ url) as Pick<typeof Pyodide, "loadPyodide">;
		const python = await loadPyodide({
			indexURL: request.assets,
			packageBaseUrl: request.assets,
			stdin: () => { throw new Error(t("playground.inputUnavailable")); },
			stdout: (text) => { send({ type: "output", level: "log", text }); },
			stderr: (text) => { send({ type: "output", level: "error", text }); },
		});
		// Inspect imports without running source. Only approved package roots can
		// load, and their dependency graph is fixed by the reduced local lockfile.
		python.registerJsModule("_playground", {
			source: request.code,
			emit_png: (encoded: string, title: string) => { send({ type: "plot", png: pngFromBase64(encoded), alt: typeof title === "string" ? title.slice(0, 300) : "Matplotlib figure" }); },
			emit_warning: (text: string) => { send({ type: "output", level: "warn", text }); },
		});
		python.runPython(installWarningCapture);
		const imported = parseJson(python.runPython('import json as __pg_json\nfrom _playground import source as __pg_source\nfrom pyodide.code import find_imports as __pg_find_imports\n__pg_json.dumps(__pg_find_imports(__pg_source))') as string);
		const packages = new Set(request.pythonPackages);
		if (!Array.isArray(imported)) throw new Error("Could not inspect Python imports");
		for (const name of imported) if (typeof name === "string" && isPythonPackage(name)) packages.add(name);
		if (packages.size) {
			send({ type: "status", text: t("playground.packagesLoading", { packages: [...packages].join(", ") }) });
			await python.loadPackage([...packages], {
				checkIntegrity: true,
				messageCallback: () => { /* Keep the localized package-loading status. */ },
				errorCallback: (text) => { send({ type: "output", level: "warn", text }); },
			});
		}
		const plots = packages.has("matplotlib") || packages.has("seaborn");
		if (plots) {
			python.runPython(installPlotCapture);
		}
		send({ type: "ready" });
		await python.runPythonAsync(request.code);
		if (plots) python.runPython("__playground_flush_plots()");
		send({ type: "done" });
	} catch (error) {
		send({ type: "error", text: error instanceof Error ? error.message : String(error) });
	}
}
