import type { RunRequest } from "./contracts.ts";
import { formatValue, outputChannel } from "./output.ts";

self.addEventListener("message", (event: MessageEvent<RunRequest>) => { void run(event.data); }, { once: true });

async function run(request: RunRequest) {
	const send = outputChannel(request.port);
	for (const level of ["log", "info", "debug", "warn", "error"] as const) {
		console[level] = (...values: Parameters<typeof formatValue>[0][]) => {
			// Vite's worker HMR connection logs are infrastructure, not code output.
			if (import.meta.env.DEV && level === "debug" && values.length === 1 && (values[0] === "[vite] connected." || values[0] === "[vite] connecting...")) return;
			send({ type: "output", level: level === "warn" || level === "error" ? level : "log", text: values.map(formatValue).join(" ") });
		};
	}
	self.addEventListener("unhandledrejection", (event) => { event.preventDefault(); send({ type: "error", text: formatValue(event.reason as object | string) }); });
	self.addEventListener("error", (event) => { event.preventDefault(); send({ type: "error", text: event.message }); });
	let url: string | undefined;
	try {
		const code = request.runtime === "typescript" ? (await import("./transpile.ts")).transpileTypeScript(request.code) : request.code;
		send({ type: "ready" });
		url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
		await import(/* @vite-ignore */ url);
		send({ type: "done" });
	} catch (error) {
		send({ type: "error", text: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
	} finally {
		if (url) URL.revokeObjectURL(url);
	}
}
