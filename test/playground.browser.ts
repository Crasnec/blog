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
	await page.waitForFunction(({ label, text }) => [...document.querySelectorAll("[data-code-playground]")].some((el) => el.getAttribute("aria-label") === label && el.querySelector(".cm-content")?.textContent === text), { label: await root.getAttribute("aria-label"), text: code.replaceAll("\n", "") });
}
async function execute(root: Locator, code: string, expected: "done" | "error" | "timeout" = "done") {
	await edit(root, code);
	await root.locator(".playground-run").click();
	await root.locator("xpath=self::*[@data-run-state='done' or @data-run-state='error' or @data-run-state='timeout']").waitFor({ timeout: 185_000 });
	const result = (await root.locator(".playground-output").innerText()).trim();
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

void test("XML TextMate grammars can replace highlighting and malformed grammars can be reset", async () => {
	const root = playground("signal");
	await root.locator("summary").click();
	await edit(root, "SPECIAL α");
	const xml = '<?xml version="1.0"?><plist version="1.0"><dict><key>scopeName</key><string>source.xml-test</string><key>patterns</key><array><dict><key>name</key><string>keyword.control</string><key>match</key><string>SPECIAL</string></dict></array></dict></plist>';
	const upload = root.locator("input[type=file]");
	await upload.setInputFiles({ name: "custom.tmLanguage", mimeType: "text/xml", buffer: Buffer.from(xml) });
	await page.waitForFunction(() => [...document.querySelectorAll("[data-code-playground]")].some((el) => el.querySelector(".playground-grammar-status")?.textContent.includes("Highlighting: custom.tmLanguage")));
	const token = root.locator('[data-textmate-token][style*="token-keyword"]').first();
	assert.equal(await token.innerText(), "SPECIAL");
	await upload.setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{") });
	await root.locator("xpath=self::*[@data-highlight='error']").waitFor();
	assert.equal(await root.locator(".cm-content").innerText(), "SPECIAL α");
	await root.locator(".playground-grammar-reset").click();
	await root.locator("xpath=self::*[@data-highlight='ready']").waitFor();
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
