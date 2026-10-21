import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";

import { isJsonObject, parseJson } from "../src/utils/json.ts";
import { statisticsExamples } from "../src/content/posts/build/_figures/statistics-data.ts";

let browser: Browser | undefined;
let page: Page;
let base: string;
const errors: string[] = [];

before(async () => {
	if (process.env.FIGURES_BASE) {
		base = process.env.FIGURES_BASE;
	} else {
		const lock = parseJson(await readFile(new URL("../.astro/dev.json", import.meta.url), "utf8"));
		if (!isJsonObject(lock) || typeof lock.url !== "string") {
			throw new Error("Start astro dev --background, or set FIGURES_BASE to a running dev server");
		}
		base = lock.url;
	}
	browser = await chromium.launch();
	page = await browser.newPage({
		viewport: { width: 900, height: 1200 },
		reducedMotion: "reduce",
	});
	page.on("pageerror", (error) => errors.push(error.message));
});

after(async () => {
	await browser?.close();
	assert.deepEqual(errors, []);
});

void test("reduced motion holds the end frame and allows a manual replay", async () => {
	await page.goto(new URL("/posts/build/animated-figures/", base).href, { waitUntil: "networkidle" });
	const figure = page.locator(".figure.is-ready").first();
	await figure.scrollIntoViewIfNeeded();
	await page.evaluate(() => document.fonts.ready);
	const replay = figure.locator(".figure-replay");
	await replay.waitFor({ state: "visible" });
	const still = await figure.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
	await replay.click();
	await page.waitForFunction((before) => {
		const canvas = document.querySelector(".figure canvas");
		return canvas instanceof HTMLCanvasElement && canvas.toDataURL() !== before;
	}, still);
	await replay.waitFor({ state: "visible", timeout: 15_000 });
});

void test("a held reduced-motion figure updates its backing store after resizing", async () => {
	await page.setViewportSize({ width: 820, height: 1200 });
	await page.waitForFunction(() => {
		const canvas = document.querySelector(".figure canvas");
		return canvas instanceof HTMLCanvasElement && canvas.width === Math.round(canvas.clientWidth * devicePixelRatio);
	});
});

void test("replaying and finishing preserve figure bounds with and without a caption", async () => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(new URL("/posts/build/statistical-figures/", base).href, { waitUntil: "networkidle" });
	await page.evaluate(() => document.fonts.ready);
	assert.equal(await page.locator(".post-body section > p > code").filter({ hasText: /^kind=/u }).count(), 0);
	const figure = page.locator(".figure.is-ready").first();
	const replay = figure.locator(".figure-replay");
	const measure = () => figure.evaluate((root) => {
		const bounds = root.getBoundingClientRect();
		const canvas = root.querySelector("canvas")?.getBoundingClientRect();
		return {
			width: bounds.width, height: bounds.height,
			canvasWidth: canvas?.width, canvasHeight: canvas?.height,
			captionWidth: root.querySelector("figcaption span")?.getBoundingClientRect().width,
		};
	});
	for (const caption of [true, false]) {
		if (!caption) await figure.locator("figcaption span").evaluate((span) => { span.remove(); });
		await replay.waitFor({ state: "visible" });
		const finished = await measure();
		await replay.click();
		await replay.waitFor({ state: "hidden" });
		assert.deepEqual(await measure(), finished, "restarting must not resize or rewrap the figure");
		await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => { resolve(); })));
		assert.deepEqual(await measure(), finished, "animation must retain the same geometry");
		await replay.waitFor({ state: "visible", timeout: 15_000 });
		assert.deepEqual(await measure(), finished, "completion must retain the same geometry");
	}
});

void test("a frozen figure recomputes its height when switching to phone width", async () => {
	await page.setViewportSize({ width: 900, height: 1200 });
	await page.goto(new URL("/posts/build/figure-sequence/?figure-at=1", base).href, { waitUntil: "networkidle" });
	const canvas = page.locator(".figure.is-ready canvas").first();
	const height = await canvas.evaluate((el: HTMLCanvasElement) => el.clientHeight);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForFunction((wideHeight) => {
		const el = document.querySelector(".figure canvas");
		return el instanceof HTMLCanvasElement && el.clientHeight > wideHeight && el.width === Math.round(el.clientWidth * devicePixelRatio);
	}, height);
});

void test("all 30 statistical figures animate, resize and repaint in dark mode", async () => {
	await page.addInitScript((kinds: string[]) => {
		// Store the prototype method deliberately; the wrapper restores its receiver with .call.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = CanvasRenderingContext2D.prototype.fillText;
		CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
			const root = this.canvas.closest<HTMLElement>(".figure");
			if (root && kinds.includes(root.dataset.figure ?? "")) {
				const metrics = this.measureText(value);
				const left = this.textAlign === "center" ? x - metrics.width / 2 : this.textAlign === "right" || this.textAlign === "end" ? x - metrics.width : x;
				if (left < -1 || left + metrics.width > this.canvas.clientWidth + 1 || y - metrics.actualBoundingBoxAscent < -1 || y + metrics.actualBoundingBoxDescent > this.canvas.clientHeight + 1) {
					root.dataset.statisticsOverflow = `${value} at (${String(x)}, ${String(y)}) in ${String(this.canvas.clientWidth)} × ${String(this.canvas.clientHeight)}`;
				}
			}
			if (maxWidth === undefined) original.call(this, value, x, y);
			else original.call(this, value, x, y, maxWidth);
		};
	}, statisticsExamples.map((e) => e.kind));
	await page.setViewportSize({ width: 900, height: 1200 });
	const load = async (at: number) => {
		await page.goto(new URL(`/posts/build/statistical-figures/?figure-at=${String(at)}`, base).href, { waitUntil: "networkidle" });
		await page.waitForFunction(() => document.querySelectorAll(".figure.is-ready").length === 30);
		await page.evaluate(() => document.fonts.ready);
	};
	const snapshots = () => page.locator(".figure canvas").evaluateAll((canvases) => canvases.map((el) => el instanceof HTMLCanvasElement ? el.toDataURL() : ""));
	await load(0.15);
	const early = await snapshots();
	await load(1);
	const finished = await snapshots();
	assert.equal(finished.length, 30);
	assert.ok(finished.every((data, i) => data !== early[i]), "every kind should change between the early and final frame");
	const actualKinds = await page.locator(".figure").evaluateAll((figures) => figures.map((el) => el.getAttribute("data-figure")).sort());
	assert.deepEqual(actualKinds, statisticsExamples.map((e) => e.kind).sort());
	for (const width of [390, 340]) {
		await page.setViewportSize({ width, height: 844 });
		await page.waitForFunction(() => [...document.querySelectorAll(".figure canvas")].every((el) => el instanceof HTMLCanvasElement && el.width === Math.round(el.clientWidth * devicePixelRatio)));
		const overflow = await page.locator(".figure[data-statistics-overflow]").evaluateAll((figures) => figures.map((el) => ({ kind: el.getAttribute("data-figure"), text: el.getAttribute("data-statistics-overflow") })));
		assert.deepEqual(overflow, [], "statistical labels must stay inside their canvases");
	}
	const light = await snapshots();
	await page.evaluate(() => { document.documentElement.classList.add("dark"); });
	await page.waitForFunction((previous) => {
		const canvas = document.querySelector(".figure canvas");
		return canvas instanceof HTMLCanvasElement && canvas.toDataURL() !== previous;
	}, light[0]);
	const dark = await snapshots();
	assert.ok(dark.every((data, i) => data !== light[i]), "every held statistical figure should repaint for dark mode");
});

void test("post-specific TSX figures render in MDX and reuse the canvas runtime", async () => {
	await page.setViewportSize({ width: 900, height: 1200 });
	const load = async (at: number) => {
		await page.goto(new URL(`/posts/build/animated-figures/?figure-at=${String(at)}`, base).href, { waitUntil: "networkidle" });
		await page.waitForFunction(() => document.querySelectorAll('.figure[data-figure="queue"].is-ready').length === 2);
		await page.evaluate(() => document.fonts.ready);
	};
	const snapshots = () => page.locator('.figure[data-figure="queue"] canvas').evaluateAll((canvases) => canvases.map((el) => el instanceof HTMLCanvasElement ? el.toDataURL() : ""));
	await load(0.15);
	const early = await snapshots();
	await load(1);
	assert.ok((await snapshots()).every((data, i) => data !== early[i]));
	assert.equal(await page.locator("astro-island .figure").count(), 0, "TSX figure composition must not require React hydration");
	const svg = page.locator('.figure[data-static-figure="normal-coverage"] svg');
	assert.match(await svg.getAttribute("aria-label") ?? "", /95\.0%/u);
	assert.equal(await svg.locator("path").count(), 2);
	await page.setViewportSize({ width: 340, height: 844 });
	await page.waitForFunction(() => [...document.querySelectorAll('.figure[data-figure="queue"] canvas')].every((el) => el instanceof HTMLCanvasElement && el.width === Math.round(el.clientWidth * devicePixelRatio)));
	const bounds = await svg.boundingBox();
	assert.ok(bounds && bounds.width > 0 && bounds.x >= 0 && bounds.x + bounds.width <= 340);
	const html = await (await page.request.get(new URL("/posts/build/animated-figures/", base).href)).text();
	assert.match(html, /data-static-figure="normal-coverage"/u, "the bespoke SVG must exist in server-rendered HTML");
	assert.match(html, /Dedicated queues/u);
});

void test("all remaining post examples use the shared runtime at desktop and phone widths", async () => {
	const pages = [
		["sequence", 1], ["state-machine", 1], ["sort", 2], ["grid-search", 3],
		["hash-ring", 3], ["tree", 4], ["gantt", 3], ["heatmap", 1], ["memory", 2],
	] as const;
	for (const [name, count] of pages) {
		await page.setViewportSize({ width: 900, height: 1200 });
		await page.goto(new URL(`/posts/build/figure-${name}/?figure-at=1`, base).href, { waitUntil: "networkidle" });
		await page.waitForFunction((n) => document.querySelectorAll(".figure.is-ready").length === n, count);
		assert.equal(await page.locator("astro-island .figure").count(), 0, name);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForFunction(() => [...document.querySelectorAll(".figure canvas")].every((el) => el instanceof HTMLCanvasElement && el.width > 0 && el.width === Math.round(el.clientWidth * devicePixelRatio)));
	}
});

void test("different domains reuse typed diagrams for signed, constant, named-key and unreachable data", async () => {
	await page.setViewportSize({ width: 340, height: 844 });
	await page.goto(new URL("/posts/build/figure-data-inputs/?figure-at=1", base).href, { waitUntil: "networkidle" });
	await page.waitForFunction(() => document.querySelectorAll(".figure.is-ready").length === 7);
	const input = await page.locator('.figure[data-figure="hash-ring"]').getAttribute("data-props");
	assert.ok(input);
	const parsed = parseJson(input);
	assert.ok(isJsonObject(parsed));
	assert.deepEqual(parsed.keys, ["user:42", "order:7", "cache:9", "user:108"]);
	const overflow = await page.locator(".figure").evaluateAll((figures) => figures.some((figure) => figure.getBoundingClientRect().right > innerWidth));
	assert.equal(overflow, false);
	assert.equal(await page.locator("astro-island .figure").count(), 0);
});
