import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { chromium, type Browser, type Locator, type Page, type Request } from "playwright";
import { isJsonObject, parseJson } from "../src/utils/json.ts";

let browser: Browser;
let page: Page;
let base: string;
const errors: string[] = [];
const demo = "/posts/build/browser-code/";
const demoEditors = 6;
const playground = (language: string) => page.locator(`[data-code-playground][data-config*='"language":"${language}"']`).first();

before(async () => {
	if (process.env.PLAYGROUND_BASE) base = process.env.PLAYGROUND_BASE;
	else {
		const lock = parseJson(await readFile(new URL("../.astro/dev.json", import.meta.url), "utf8"));
		if (!isJsonObject(lock) || typeof lock.url !== "string") throw new Error("Start astro dev --background or set PLAYGROUND_BASE");
		base = lock.url;
	}
	browser = await chromium.launch();
	page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: "reduce" });
	page.setDefaultTimeout(20_000);
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(new URL(demo, base).href);
	await page.locator('[data-code-playground][data-ready="true"]').nth(demoEditors - 1).waitFor();
});
after(async () => { await browser.close(); assert.deepEqual(errors, []); });

async function edit(root: Locator, code: string) {
	const editor = root.locator(".cm-content");
	await editor.fill(code);
	try {
		await page.waitForFunction(({ label, text }) => [...document.querySelectorAll("[data-code-playground]")].some((el) => el.getAttribute("aria-label") === label && el.querySelector(".cm-content")?.textContent === text), { label: await root.getAttribute("aria-label"), text: code.replaceAll("\n", "") });
	} catch (error) {
		console.error("Editor content mismatch", { expected: code, actual: await editor.textContent(), html: await editor.innerHTML() });
		throw error;
	}
}
async function execute(root: Locator, code: string, expected: "done" | "error" | "timeout" = "done") {
	await edit(root, code);
	await root.locator(".playground-run").click();
	await root.locator("xpath=self::*[@data-run-state='done' or @data-run-state='error' or @data-run-state='timeout']").waitFor({ timeout: 185_000 });
	const result = (await root.locator(".playground-output-line").allTextContents()).join("").trim();
	assert.equal(await root.getAttribute("data-run-state"), expected, result);
	return result;
}

void test("editors highlight their initial source without executing it", async () => {
	await page.waitForFunction((expected) => document.querySelectorAll('[data-highlight="ready"]').length === expected, demoEditors);
	assert.equal(await page.locator(".cm-editor").count(), demoEditors);
	assert.equal(await page.locator("[data-run-state]").count(), 0);
	assert.ok(await playground("signal").locator("[data-textmate-token]").count() > 0);
});

void test("JavaScript runs async modules, captures mixed values and renders output as text", async () => {
	const root = playground("javascript");
	const result = await execute(root, 'await Promise.resolve(); console.log("value", 42, {ok:true}); console.warn("warning"); console.log("<img src=x onerror=alert(1)>");');
	assert.match(result, /value 42/); assert.match(result, /"ok": true/);
	assert.match(result, /warning/); assert.match(result, /<img/);
	assert.equal(await root.locator(".playground-output img").count(), 0);
	assert.equal(await execute(root, 'console.log(typeof document, typeof localStorage);'), "undefined undefined");
});

void test("TypeScript compiles enums and reports syntax errors, then recovers", async () => {
	const root = playground("typescript");
	assert.match(await execute(root, 'enum Count { Two = 2 }; const n: Count = Count.Two; console.log(await Promise.resolve(n * 3));'), /6/);
	assert.match(await execute(root, "const = ;", "error"), /SyntaxError/);
	assert.match(await execute(root, 'const value: number = 9; console.log(value);'), /9/);
});

void test("Python runs its real standard library, reports exceptions and starts fresh", async () => {
	const root = playground("python");
	assert.match(await execute(root, 'from statistics import mean\nx = 7\nprint("mean:", mean([2,4,6]))'), /mean: 4/);
	assert.match(await execute(root, 'print("x" in globals())'), /False/);
	assert.match(await execute(root, 'raise ValueError("example failure")', "error"), /ValueError: example failure/);
	assert.match(await execute(root, 'import warnings\nwarnings.warn("example warning", UserWarning)'), /UserWarning: example warning/);
	assert.equal(await root.locator(".playground-output-line.is-warn").count(), 1);
	assert.equal(await root.locator(".playground-output-line.is-error").count(), 0);
});

void test("JavaScript and TypeScript import npm packages with versions, scopes, and dynamic imports", async () => {
	const result = await execute(playground("javascript"), 'import {mean} from "lodash-es@4.17.21";\nconst {hex} = await import("npm:@scure/base@1.2.6");\nconsole.log(mean([2, 4, 6]));\nconsole.log(hex.encode(new Uint8Array([1, 2, 255])));');
	assert.match(result, /4\n0102ff/u);
	assert.equal(await execute(playground("typescript"), 'import {mean} from "lodash-es@4.17.21";\nconst values: number[] = [3, 6, 9];\nconsole.log(mean(values));'), "6");
	assert.match(await execute(playground("javascript"), 'import fs from "node:fs";', "error"), /Node.js built-in/u);
});

void test("Python imports additional native packages and installs pure Python wheels from PyPI", async () => {
	const root = page.locator('[data-code-playground][data-config*=\'"language":"python"\']').nth(1);
	assert.match(await execute(root, 'import yaml\nfrom PIL import Image\nprint(yaml.safe_load("value: 7")["value"])\nprint(Image.new("RGB", (2, 3)).size)'), /7\n\(2, 3\)/u);
	assert.equal(await execute(root, 'import micropip\nawait micropip.install("humanize==4.13.0")\nimport humanize\nprint(humanize.intcomma(1234567))'), "1,234,567");
	const preloaded = page.locator('[data-code-playground][aria-label="Python · Additional packages"]');
	await preloaded.locator(".playground-run").click();
	await preloaded.locator("xpath=self::*[@data-run-state='done' or @data-run-state='error']").waitFor({ timeout: 185_000 });
	assert.equal(await preloaded.getAttribute("data-run-state"), "done", await preloaded.locator(".playground-output").innerText());
	assert.equal((await preloaded.locator(".playground-output").innerText()).trim(), "1,234,567");
	// Leave the original scientific example ready for the following plot test.
	await root.locator(".playground-reset").click();
});

void test("approved scientific libraries load on demand and produce downloadable PNG plots", async () => {
	const root = page.locator('[data-code-playground][data-config*=\'"language":"python"\']').nth(1);
	const scientificRequests: string[] = [];
	const record = (request: Request) => { if (request.url().includes(".whl")) scientificRequests.push(request.url()); };
	page.on("request", record);
	try {
		await root.locator(".playground-run").click();
		await root.locator("xpath=self::*[@data-run-state='done' or @data-run-state='error']").waitFor({ timeout: 185_000 });
		assert.equal(await root.getAttribute("data-run-state"), "done", await root.locator(".playground-output").innerText());
		await root.locator(".playground-plot img").evaluate(async (image: HTMLImageElement) => { await image.decode(); });
		assert.equal(await root.locator(".playground-plot").count(), 1);
		assert.equal(await root.locator(".playground-plot img").getAttribute("alt"), "A reproducible sample");
		const result = await execute(root, 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nprint(round(float(np.mean([2,4,6])), 1))\nprint(pd.DataFrame({"x":[1,2]}).shape)\nprint(round(float(stats.norm.cdf(0)), 1))\nprint(sns.__version__)\nplt.plot([1,2],[3,4]); plt.title("First"); plt.show()\nplt.figure(); plt.plot([1,2],[4,3]); plt.title("Second")');
		assert.match(result, /4\.0/); assert.match(result, /\(2, 1\)/); assert.match(result, /0\.5/); assert.match(result, /0\.13\.2/);
		assert.equal(await root.locator(".playground-plot").count(), 2, "explicit show and automatic final capture must not duplicate figures");
		for (const image of await root.locator(".playground-plot img").all()) await image.evaluate(async (element: HTMLImageElement) => { await element.decode(); });
		const download = page.waitForEvent("download");
		await root.locator(".playground-plot a").first().click();
		assert.equal((await download).suggestedFilename(), "plot-1.png");
		assert.ok(scientificRequests.length > 0);
		assert.ok(scientificRequests.every((url) => new URL(url).origin === new URL(base).origin));
		await root.locator(".playground-reset").click();
		assert.equal(await root.locator(".playground-plot").count(), 0);
	} finally { page.off("request", record); }
});


void test("approved statistics packages import, compute and capture empiricaldist plots", async () => {
	const root = page.locator('[data-code-playground][data-config*=\'"language":"python"\']').nth(1);
	const requests: string[] = [];
	const record = (request: Request) => { if (request.url().includes(".whl")) requests.push(request.url()); };
	page.on("request", record);
	try {
		const result = await execute(root, String.raw`from empiricaldist import FreqTab
from statadict import parse_stata_dict
from pathlib import Path
import statsmodels.api as sm
from IPython.display import HTML
freq = FreqTab.from_seq([1, 1, 2, 3])
print("frequency:", int(freq[1]))
print("slope:", round(float(sm.OLS([1, 3, 5], sm.add_constant([0, 1, 2])).fit().params[1]), 6))
Path("example.dct").write_text('dictionary {\n  _column(1) int example %2f "Example"\n}')
dct = parse_stata_dict("example.dct")
print("dictionary:", dct.names)
print("html:", HTML("<b>example</b>").data)
freq.plot()`);
		assert.match(result, /frequency: 2/);
		assert.match(result, /slope: 2\.0/);
		assert.match(result, /dictionary: \['example'\]/);
		assert.match(result, /html: <b>example<\/b>/);
		assert.equal(await root.locator(".playground-output b").count(), 0);
		assert.equal(await root.locator(".playground-plot img").count(), 1);
		await root.locator(".playground-plot img").evaluate(async (img: HTMLImageElement) => { await img.decode(); });
		for (const name of ["empiricaldist", "statadict", "statsmodels", "ipython"]) assert.ok(requests.some((url) => url.includes(`/${name}-`)), name);
		assert.ok(requests.every((url) => new URL(url).origin === new URL(base).origin));
	} finally { page.off("request", record); }
});

async function submitLine(root: Locator, value: string) {
	await root.locator("xpath=self::*[@data-run-state='input']").waitFor({ timeout: 185_000 });
	await root.locator(".playground-input-value").fill(value);
	await root.locator(".playground-input-value").press("Enter");
}

void test("Python input resumes nested calls with Unicode, empty strings and EOF", async () => {
	const root = playground("python");
	await edit(root, `def ask():
    return input("이름: ")
print("before")
name = ask()
empty = input("빈 값: ")
print(repr((name, empty)))
try:
    input("end: ")
except EOFError:
    print("EOF received")`);
	await root.locator(".playground-run").click();
	await submitLine(root, "한글 <b>text</b>");
	await submitLine(root, "");
	await root.locator("xpath=self::*[@data-run-state='input']").waitFor();
	await root.locator(".playground-input-eof").click();
	await root.locator("xpath=self::*[@data-run-state='done']").waitFor();
	const result = (await root.locator(".playground-output-line").allTextContents()).join("");
	assert.match(result, /\('한글 <b>text<\/b>', ''\)/);
	assert.match(result, /EOF received/);
	assert.equal(result.match(/before/g)?.length, 1, "execution must resume rather than replay");
	assert.equal(await root.locator(".playground-output b").count(), 0);
	assert.equal(await root.locator(".playground-input").isVisible(), false);
});

void test("async Python input works without synchronous input and Stop clears pending input", async () => {
	const root = playground("python");
	await edit(root, 'print(await read_input("Value: "))');
	await root.locator(".playground-run").click();
	await submitLine(root, "async value");
	await root.locator("xpath=self::*[@data-run-state='done']").waitFor();
	assert.match((await root.locator(".playground-output-line").allTextContents()).join(""), /async value/);
	await root.locator(".playground-run").click();
	await root.locator("xpath=self::*[@data-run-state='input']").waitFor();
	await root.locator(".playground-stop").click();
	assert.equal(await root.locator(".playground-input").isVisible(), false);
	assert.equal(await root.getAttribute("data-run-state"), "stopped");
	assert.match(await execute(root, 'print("after input stop")'), /after input stop/);
});

void test("waiting for a JavaScript input does not consume execution time", async () => {
	const root = playground("javascript");
	await edit(root, 'const text = await input("Value: "); console.log("received", text);');
	await root.locator(".playground-run").click();
	await root.locator("xpath=self::*[@data-run-state='input']").waitFor();
	await new Promise((resolve) => setTimeout(resolve, 10_500));
	assert.equal(await root.getAttribute("data-run-state"), "input");
	await submitLine(root, "42");
	await root.locator("xpath=self::*[@data-run-state='done']").waitFor();
	assert.match((await root.locator(".playground-output-line").allTextContents()).join(""), /received 42/);
});

void test("Stop interrupts infinite JavaScript and Python loops and allows another execution", async () => {
	for (const language of ["javascript", "python"]) {
		const root = playground(language);
		await edit(root, language === "python" ? "while True:\n    pass" : "while (true) {}");
		await root.locator(".playground-run").click();
		await root.locator("xpath=self::*[@data-run-state='running']").waitFor({ timeout: 60_000 });
		await root.locator(".playground-stop").click();
		assert.equal(await root.getAttribute("data-run-state"), "stopped");
		assert.match(await execute(root, language === "python" ? 'print("recovered")' : 'console.log("recovered")'), /recovered/);
	}
});

void test("execution timeout, console flood and runtime errors leave the editor responsive", async () => {
	const root = playground("javascript");
	await execute(root, "while(true) {}", "timeout");
	assert.match(await execute(root, 'throw new Error("broken");', "error"), /broken/);
	await execute(root, 'for(let i=0;i<1000;i++) console.log(i);', "error");
	assert.ok((await root.locator(".playground-output-line").count()) <= 500);
	await root.locator(".playground-reset").click();
	assert.match(await root.locator(".cm-content").innerText(), /const values/);
});

void test("author-supplied grammars highlight edited code without reader upload controls", async () => {
	const root = playground("signal");
	assert.equal(await page.locator('[data-code-playground] input[type="file"]').count(), 0);
	assert.equal(await root.locator("details").count(), 0);
	await edit(root, 'series check = [42]\nmean check -> emit "value"');
	await root.locator('[data-textmate-token][style*="token-constant"]').filter({ hasText: /^42$/ }).waitFor();
	assert.equal(await root.locator('[data-textmate-token][style*="token-keyword"]').first().innerText(), "series");
	assert.equal(await root.locator('[data-textmate-token][style*="token-constant"]').first().innerText(), "42");
	assert.match((await root.locator('[data-textmate-token][style*="token-string"]').allTextContents()).join(""), /value/);
	assert.equal(await root.locator(".playground-highlight-status").isVisible(), false);
});

void test("theme changes and mobile layout preserve edited content", async () => {
	const root = playground("javascript");
	await edit(root, 'const word = "hello";');
	await page.waitForFunction(() => document.querySelector('[data-code-playground] [data-textmate-token][style*="token-string"]'));
	const token = root.locator('[data-textmate-token][style*="token-string"]').first();
	const before = await token.evaluate((el) => getComputedStyle(el).color);
	await page.evaluate(() => { document.documentElement.classList.add("dark"); });
	assert.notEqual(await token.evaluate((el) => getComputedStyle(el).color), before);
	await page.setViewportSize({ width: 390, height: 844 });
	assert.equal(await root.locator(".cm-content").innerText(), 'const word = "hello";');
	assert.equal(await page.locator("[data-code-playground]").evaluateAll((elements) => elements.some((el) => el.getBoundingClientRect().right > innerWidth)), false);
});

void test("navigation disposes active Workers and mounts editors again without duplication", async () => {
	const root = playground("javascript");
	await edit(root, "while(true) {}"); await root.locator(".playground-run").click();
	await root.locator("xpath=self::*[@data-run-state='running']").waitFor();
	const activeWorkers = page.workers();
	assert.ok(activeWorkers.length > 0);
	const closed = Promise.all(activeWorkers.map((worker) => new Promise<void>((resolve) => { worker.once("close", () => { resolve(); }); })));
	await page.locator('a[href="/"]').first().click();
	await page.waitForURL(new URL("/", base).href);
	await closed;
	assert.equal(page.workers().length, 0);
	await page.goBack();
	await page.locator('[data-code-playground][data-ready="true"]').nth(4).waitFor();
	assert.equal(await page.locator(".cm-editor").count(), demoEditors);
	assert.match(await execute(playground("javascript"), 'console.log("after navigation")'), /after navigation/);
});

async function assertNoOutputLayout(root: Locator, run: () => Promise<string>) {
	const observations = await root.evaluateHandle(async (element) => {
		await document.fonts.ready;
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { resolve(); })));
		const heights = [element.getBoundingClientRect().height];
		const observer = new ResizeObserver(() => { heights.push(element.getBoundingClientRect().height); });
		observer.observe(element);
		return { heights, observer };
	});
	try {
		await run();
		await root.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { resolve(); }))));
		const heights = await observations.evaluate(({ heights }) => heights);
		assert.ok(Math.max(...heights) - Math.min(...heights) < 1, `A silent execution changed the cell height: ${heights.join(", ")}`);
		assert.equal(await root.locator(".playground-output").isVisible(), false);
		assert.equal(await root.locator(".playground-status").isVisible(), true);
		assert.match(await root.locator(".playground-status").innerText(), /출력 없음|no output/u);
	} finally {
		await observations.evaluate(({ observer }) => { observer.disconnect(); });
		await observations.dispose();
	}
}

void test("silent standalone executions keep their height and completion status", async () => {
	await page.goto(new URL(demo, base).href);
	await page.locator('[data-code-playground][data-ready="true"]').nth(4).waitFor();
	for (const [language, code] of [
		["javascript", "await new Promise(resolve => setTimeout(resolve, 150));"],
		["typescript", "const value: number = 3; await new Promise(resolve => setTimeout(resolve, 150));"],
		["python", "import asyncio\nawait asyncio.sleep(0.15)\nvalue = 3"],
	] as const) {
		const root = playground(language);
		await edit(root, code);
		await assertNoOutputLayout(root, () => execute(root, code));
		await root.locator(".playground-reset").click();
		assert.equal(await root.locator(".playground-output").isVisible(), false);
		assert.equal(await root.locator(".playground-status").isVisible(), true);
	}
});

const notebookDemo = "/posts/build/python-notebook/";
async function notebookCells() {
	await page.goto(new URL(notebookDemo, base).href);
	await page.locator('[data-code-playground][data-ready="true"]').first().waitFor();
	return page.locator('[data-notebook="notebook-example"]');
}
async function notebookEdit(cell: Locator, code: string) {
	await cell.locator(".playground-editor").scrollIntoViewIfNeeded();
	await cell.locator(".cm-content").waitFor();
	await edit(cell, code);
}
async function notebookRun(cell: Locator, expected = "done") {
	await cell.locator(".playground-run").click();
	await cell.locator("xpath=self::*[@data-run-state='done' or @data-run-state='error' or @data-run-state='timeout']").waitFor({ timeout: 185_000 });
	const output = (await cell.locator(".playground-output-line").allTextContents()).join("");
	assert.equal(await cell.getAttribute("data-run-state"), expected, output);
	return output;
}

void test("silent notebook cells keep their height on first execution and rerun", async () => {
	const cells = await notebookCells();
	const first = cells.nth(0), second = cells.nth(1);
	await page.setViewportSize({ width: 390, height: 844 });
	await notebookEdit(first, "import asyncio\nawait asyncio.sleep(0.15)\nvalues = [2, 4, 6]");
	await assertNoOutputLayout(first, () => notebookRun(first));
	await assertNoOutputLayout(first, () => notebookRun(first));
	assert.equal(await first.locator(".notebook-execution").innerText(), "[2]");
	assert.match(await notebookRun(second), /5\.0/u, "A silent cell must still update the shared environment");
	await first.locator(".playground-reset").click();
	assert.equal(await first.locator(".playground-output").isVisible(), false);
	assert.equal(await first.locator(".playground-status").isVisible(), true);
});

void test("notebook cells share state, mark edited results stale and restart independently", async () => {
	const cells = await notebookCells();
	const first = cells.nth(0), second = cells.nth(1);
	const toolbar = page.locator('[data-python-notebook="notebook-example"]');
	await toolbar.locator(".notebook-run-all").click();
	await second.locator("xpath=self::*[@data-run-state='done']").waitFor({ timeout: 185_000 });
	assert.match(await first.locator(".playground-output").innerText(), /\[2, 4, 6\]/);
	assert.match(await second.locator(".playground-output").innerText(), /5\.0/);
	assert.match(await notebookRun(second), /5\.6/);
	assert.equal(await cells.nth(2).getAttribute("data-run-state"), null, "Run all skips author-excluded exercises");
	assert.match(await notebookRun(page.locator('[data-notebook="another-notebook"]')), /False/);
	await notebookEdit(first, "values = [100]\nvalues");
	assert.equal(await second.locator(".notebook-stale").isVisible(), true);
	await notebookRun(first);
	assert.match(await notebookRun(second), /54\.0/);
	assert.equal(await second.locator(".notebook-stale").isVisible(), false);
	await notebookEdit(cells.nth(3), "DATA_URL = '/datasets/example/'");
	const download = page.waitForEvent("download");
	await toolbar.locator(".notebook-download").click();
	const downloaded = await download;
	const contents = parseJson(await readFile(await downloaded.path(), "utf8"));
	assert.ok(isJsonObject(contents));
	assert.equal(contents.nbformat, 4);
	assert.ok(Array.isArray(contents.cells) && contents.cells.some((cell) => isJsonObject(cell) && Array.isArray(cell.source) && cell.source.some((line) => typeof line === "string" && line.includes("values = [100]"))));
	assert.ok(Array.isArray(contents.cells) && contents.cells.some((cell) => isJsonObject(cell) && Array.isArray(cell.source) && cell.source.includes(`DATA_URL = "${new URL("/datasets/example/", base).href}"`)));
	await first.locator(".playground-reset").click();
	assert.match(await notebookRun(second), /38\.666/, "resetting a cell's source must preserve shared variables");
	await notebookEdit(first, "values = [100]\nvalues");
	await toolbar.locator(".notebook-restart").click();
	assert.match(await notebookRun(second, "error"), /NameError/);
	await notebookRun(first);
	assert.match(await notebookRun(second), /54\.0/);
});

void test("notebook display and input use the current state, and Run all stops at errors", async () => {
	const cells = await notebookCells();
	const first = cells.nth(0), second = cells.nth(1), input = cells.nth(2);
	await notebookEdit(first, 'from IPython.display import HTML, display\nvalues = [2, 4, 6]\ndisplay(HTML("<b>Readable</b><script>alert(1)</script>"))\nvalues');
	assert.match(await notebookRun(first), /Readable[\s\S]*\[2, 4, 6\]/);
	assert.equal(await first.locator(".playground-output b, .playground-output script").count(), 0);
	assert.doesNotMatch(await first.locator(".playground-output").innerText(), /alert/);
	await input.locator(".playground-run").click();
	await submitLine(input, "7");
	await input.locator("xpath=self::*[@data-run-state='done']").waitFor();
	assert.match(await input.locator(".playground-output").innerText(), /2, 4, 6, 7\.0/);
	await notebookEdit(second, "sum(values)");
	assert.match(await notebookRun(second), /19\.0/);
	const badge = await second.locator(".notebook-execution").innerText();
	await notebookEdit(first, 'raise ValueError("stop this notebook")');
	await page.locator('[data-python-notebook="notebook-example"] .notebook-run-all').click();
	await page.locator('[data-python-notebook="notebook-example"] .notebook-status').filter({ hasText: /오류|error/i }).waitFor({ timeout: 185_000 });
	assert.equal(await first.getAttribute("data-run-state"), "error");
	assert.equal(await second.locator(".notebook-execution").innerText(), badge, "the following cell must not execute after a failure");
});
