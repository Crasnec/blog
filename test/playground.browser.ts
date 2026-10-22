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
	await page.locator('[data-code-playground][data-ready="true"]').nth(4).waitFor();
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
	await page.waitForFunction(() => document.querySelectorAll('[data-highlight="ready"]').length === 5);
	assert.equal(await page.locator(".cm-editor").count(), 5);
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


void test("Think Stats packages import, compute and capture empiricaldist plots", async () => {
	const root = playground("python");
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
	assert.equal(await page.locator(".cm-editor").count(), 5);
	assert.match(await execute(playground("javascript"), 'console.log("after navigation")'), /after navigation/);
});
