import { t } from "../strings";
import { decodeConfig, MAX_INPUT, MAX_OUTPUT, MAX_PLOTS, MAX_PNG, MAX_PLOT_TOTAL, type InputResponse, type RunRequest, type RunResponse } from "../playground/contracts";
import { mountEditor } from "../playground/editor";

const mounted = new Map<HTMLElement, () => void>();

function mount(root: HTMLElement) {
	const config = decodeConfig(root.dataset.config ?? "{}");
	const runButton = root.querySelector<HTMLButtonElement>(".playground-run");
	const stopButton = root.querySelector<HTMLButtonElement>(".playground-stop");
	const resetButton = root.querySelector<HTMLButtonElement>(".playground-reset");
	const output = root.querySelector<HTMLElement>(".playground-output");
	const status = root.querySelector<HTMLElement>(".playground-status");
	const inputForm = root.querySelector<HTMLFormElement>(".playground-input");
	const inputField = root.querySelector<HTMLInputElement>(".playground-input-value");
	const inputPrompt = root.querySelector<HTMLElement>(".playground-input-prompt");
	let pendingInput: { id: number; prompt: string } | undefined;
	let remaining = config.timeout;
	let activeSince = 0;
	let worker: Worker | undefined;
	let port: MessagePort | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let outputSize = 0;
	let outputLines = 0;
	let disposed = false;
	let plotBytes = 0;
	const plotURLs: string[] = [];
	function clearOutput() {
		for (const url of plotURLs) URL.revokeObjectURL(url);
		plotURLs.length = 0; plotBytes = 0;
		output?.replaceChildren(); outputSize = 0; outputLines = 0;
	}
	function finish(message: string, state: string) {
		clearTimeout(timer); pendingInput = undefined;
		if (inputForm) inputForm.hidden = true;
		worker?.terminate(); worker = undefined;
		port?.close(); port = undefined;
		if (status) status.textContent = message;
		if (runButton) runButton.disabled = false;
		if (stopButton) stopButton.disabled = true;
		root.dataset.runState = state;
	}
	function append(text: string, level: string) {
		if (!output) return;
		output.querySelector(".playground-output-placeholder")?.remove();
		if (++outputLines > 500 || outputSize + text.length > MAX_OUTPUT) {
			finish(t("playground.outputLimit"), "error"); return;
		}
		outputSize += text.length;
		const line = document.createElement("span");
		line.className = `playground-output-line is-${level}`;
		line.textContent = `${text}\n`;
		output.append(line);
		output.scrollTop = output.scrollHeight;
	}
	function appendPlot(png: ArrayBuffer, alt: string) {
		if (!output) return;
		plotBytes += png.byteLength;
		if (plotURLs.length >= MAX_PLOTS || png.byteLength > MAX_PNG || plotBytes > MAX_PLOT_TOTAL) { finish(t("playground.plotLimit"), "error"); return; }
		output.querySelector(".playground-output-placeholder")?.remove();
		const url = URL.createObjectURL(new Blob([png], { type: "image/png" }));
		plotURLs.push(url);
		const figure = document.createElement("figure"); figure.className = "playground-plot";
		const image = document.createElement("img"); image.src = url; image.alt = alt;
		const link = document.createElement("a"); link.href = url; link.download = `plot-${String(plotURLs.length)}.png`; link.textContent = t("playground.downloadPlot");
		figure.append(image, link); output.append(figure);
	}
	function resumeClock() {
		activeSince = performance.now();
		timer = setTimeout(() => { finish(t("playground.timedOut"), "timeout"); }, Math.max(0, remaining));
	}
	function requestInput(id: number, prompt: string) {
		if (pendingInput || !inputForm || !inputField || !inputPrompt) return;
		clearTimeout(timer); remaining -= performance.now() - activeSince;
		pendingInput = { id, prompt };
		inputPrompt.textContent = prompt || t("playground.inputLabel");
		inputField.value = ""; inputForm.hidden = false;
		root.dataset.runState = "input";
		if (status) status.textContent = t("playground.inputWaiting");
		inputField.focus();
	}
	function submitInput(value: string | null) {
		if (!pendingInput || !port || (value !== null && value.length > MAX_INPUT)) return;
		const { id, prompt } = pendingInput; pendingInput = undefined;
		if (inputForm) inputForm.hidden = true;
		append(`${prompt}${value ?? t("playground.inputEof")}`, "log");
		if (!worker) return;
		root.dataset.runState = "running";
		if (status) status.textContent = t("playground.running");
		resumeClock();
		const response: InputResponse = { type: "input", id, value };
		port.postMessage(response);
	}
	inputForm?.addEventListener("submit", (event) => { event.preventDefault(); submitInput(inputField?.value ?? ""); });
	root.querySelector(".playground-input-eof")?.addEventListener("click", () => { submitInput(null); });
	function run() {
		if (disposed || worker || !config.runtime) return;
		clearOutput();
		root.dataset.runState = "loading";
		if (status) status.textContent = t("playground.loading");
		if (runButton) runButton.disabled = true;
		if (stopButton) stopButton.disabled = false;
		try {
			worker = config.runtime === "python"
				? new Worker(new URL("../playground/python.worker.ts", import.meta.url), { type: "module" })
				: new Worker(new URL("../playground/javascript.worker.ts", import.meta.url), { type: "module" });
			const channel = new MessageChannel();
			port = channel.port1;
			port.onmessage = (event: MessageEvent<RunResponse>) => {
				const response = event.data;
				switch (response.type) {
					case "input": requestInput(response.id, response.prompt); break;
					case "output": append(response.text, response.level); break;
					case "plot": appendPlot(response.png, response.alt); break;
					case "status": if (status) status.textContent = response.text; break;
					case "ready":
						clearTimeout(timer); root.dataset.runState = "running";
						if (status) status.textContent = t("playground.running");
						remaining = config.timeout; resumeClock();
						break;
					case "error": append(response.text, "error"); finish(t("playground.failed"), "error"); break;
					case "done": finish(t("playground.done"), "done"); break;
				}
			};
			worker.onerror = (event) => { event.preventDefault(); append(event.message, "error"); finish(t("playground.failed"), "error"); };
			timer = setTimeout(() => { finish(t("playground.loadTimeout"), "timeout"); }, 180_000);
			const request: RunRequest = { code: editor.code(), runtime: config.runtime, port: channel.port2, pythonPackages: config.pythonPackages, assets: new URL(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}runtime/pyodide/`, location.origin).href };
			worker.postMessage(request, [channel.port2]);
		} catch (error) {
			append(error instanceof Error ? error.message : String(error), "error");
			finish(t("playground.failed"), "error");
		}
	}
	const editor = mountEditor(root, config, run);
	runButton?.addEventListener("click", run);
	stopButton?.addEventListener("click", () => { finish(t("playground.stopped"), "stopped"); });
	resetButton?.addEventListener("click", () => {
		finish(t("playground.idle"), "idle"); editor.reset();
		clearOutput();
	});
	if (runButton) runButton.disabled = false;
	if (resetButton) resetButton.disabled = false;
	root.dataset.ready = "true";
	return () => { disposed = true; finish("", "disposed"); clearOutput(); editor.destroy(); };
}

export function mountPlaygrounds() {
	for (const [root, dispose] of mounted) if (!root.isConnected) { dispose(); mounted.delete(root); }
	for (const root of document.querySelectorAll<HTMLElement>("[data-code-playground]")) {
		if (mounted.has(root)) continue;
		try { mounted.set(root, mount(root)); }
		catch (error) {
			const status = root.querySelector<HTMLElement>(".playground-highlight-status");
			if (status) { status.textContent = error instanceof Error ? error.message : String(error); status.hidden = false; }
		}
	}
}

document.addEventListener("astro:before-swap", () => {
	for (const dispose of mounted.values()) dispose();
	mounted.clear();
});
