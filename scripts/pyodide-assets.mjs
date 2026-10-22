import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pythonDistribution, preparePythonPackages } from "./python-packages.mjs";

// Serve the pinned runtime, bundled wheels, and full catalog with CDN URLs.
const files = new Map([
	["pyodide.mjs", "text/javascript"],
	["pyodide.asm.mjs", "text/javascript"], ["pyodide.asm.wasm", "application/wasm"],
	["python_stdlib.zip", "application/zip"], ["pyodide-lock.json", "application/json"],
]);
const root = dirname(fileURLToPath(import.meta.resolve("pyodide")));

/** @returns {import('astro').AstroIntegration} */
export default function pyodideAssets() {
	const distribution = pythonDistribution();
	const wheels = new Map(distribution.files.map((entry) => [entry.file_name, entry.path]));
	const lock = JSON.stringify(distribution.lock);
	return {
		name: "local-pyodide-assets",
		hooks: {
			"astro:config:setup": ({ updateConfig, config }) => {
				const prefix = `${config.base.replace(/\/$/, "")}/runtime/pyodide/`;
				updateConfig({ vite: {
					optimizeDeps: {
						exclude: ["pyodide"],
						// Pre-bundle worker dependencies so the first TS execution does
						// not trigger a Vite reload that would discard the reader's edits.
						include: ["typescript", "codemirror", "@codemirror/state", "@codemirror/view", "@codemirror/commands", "shiki/core", "shiki/engine/oniguruma", "shiki/langs/javascript.mjs", "shiki/langs/typescript.mjs", "shiki/langs/python.mjs", "shiki/wasm", "vscode-textmate"],
					},
					worker: { format: "es" },
					plugins: [{
						name: "serve-local-pyodide", configureServer(server) {
							server.middlewares.use((request, response, next) => {
								const pathname = request.url?.split("?")[0] ?? "";
								if (!pathname.startsWith(prefix)) return next();
								const name = pathname.slice(prefix.length);
								const mime = files.get(name) ?? (wheels.has(name) ? "application/octet-stream" : undefined);
								if (!mime) { response.statusCode = 404; response.end(); return; }
								const content = name === "pyodide-lock.json" ? Promise.resolve(Buffer.from(lock)) : readFile(wheels.get(name) ?? join(root, name));
								void content.then((data) => {
									response.setHeader("Content-Type", mime);
									response.end(data);
								}).catch(next);
							});
						},
					}],
				} });
			},
			"astro:server:setup": async () => { await preparePythonPackages(); },
			"astro:build:start": async () => { await preparePythonPackages(); },
			"astro:build:done": async ({ dir }) => {
				const target = new URL("runtime/pyodide/", dir);
				await mkdir(target, { recursive: true });
				await Promise.all([...files.keys()].filter((name) => name !== "pyodide-lock.json").map((name) => copyFile(join(root, name), new URL(name, target))));
				await writeFile(new URL("pyodide-lock.json", target), lock);
				await Promise.all(distribution.files.map((entry) => copyFile(entry.path, new URL(entry.file_name, target))));
			},
		},
	};
}
