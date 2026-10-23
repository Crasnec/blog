import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { serveStaticSite } from "#root/test/helpers/static-site.ts";

let browser: Browser;
let page: Page;
let base: string;
const errors: string[] = [];
const directory = process.env.FIGURES_DIST;
const output = process.env.FIGURES_OUT;

before(async () => {
    if (!directory) {
        throw new Error(
            "Set FIGURES_DIST to a production build containing /posts/build/basic-charts/",
        );
    }
    browser = await chromium.launch();
    page = await browser.newPage({ reducedMotion: "reduce" });
    base = await serveStaticSite(page.context(), directory);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
            const root = this.canvas.closest<HTMLElement>(".figure");
            if (root) {
                const metrics = this.measureText(value);
                const left =
                    this.textAlign === "center"
                        ? x - metrics.width / 2
                        : this.textAlign === "right"
                            ? x - metrics.width
                            : x;
                if (
                    left < -1 ||
                    left + metrics.width > this.canvas.clientWidth + 1 ||
                    y - metrics.actualBoundingBoxAscent < -1 ||
                    y + metrics.actualBoundingBoxDescent > this.canvas.clientHeight + 1
                ) {
                    root.dataset.chartOverflow = `${value} at ${String(left)}, ${String(y)} in ${String(this.canvas.clientWidth)}×${String(this.canvas.clientHeight)}; width=${String(metrics.width)} descent=${String(metrics.actualBoundingBoxDescent)}`;
                }
            }
            if (maxWidth === undefined) {
                original.call(this, value, x, y);
            } else {
                original.call(this, value, x, y, maxWidth);
            }
        };
    });
    if (output) {
        await mkdir(output, { recursive: true });
    }
});

after(async () => {
    await browser.close();
    assert.deepEqual(errors, []);
});

async function load(at?: number): Promise<void> {
    const path = `/posts/build/basic-charts/${at === undefined ? "" : `?figure-at=${String(at)}`}`;
    await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll(".figure.is-ready").length === 10);
    await page.evaluate(() => document.fonts.ready);
    if (output) {
        await page.addStyleTag({
            content: "#back-to-top, #navbar-wrapper { visibility: hidden !important; }",
        });
    }
}

function snapshots(): Promise<string[]> {
    return page
        .locator(".figure canvas")
        .evaluateAll((elements) =>
            elements.map((element) =>
                element instanceof HTMLCanvasElement ? element.toDataURL() : "",
            ),
        );
}

void test("basic charts render every variant at phone and desktop widths in both themes", async () => {
    for (const width of [340, 390, 1200]) {
        await page.setViewportSize({ width, height: 900 });
        await load(0.35);
        const early = await snapshots();
        if (output && width === 390) {
            await page
                .locator(".figure")
                .first()
                .screenshot({ path: resolve(output, "early-bar.png") });
            await page
                .locator(".figure")
                .nth(6)
                .screenshot({ path: resolve(output, "early-donut.png") });
            await page
                .locator(".figure")
                .nth(8)
                .screenshot({ path: resolve(output, "early-area.png") });
        }
        await load(1);
        const light = await snapshots();
        assert.ok(light.every((data, i) => data !== early[i]));
        for (const theme of ["light", "dark"]) {
            await page.evaluate(
                (dark) => document.documentElement.classList.toggle("dark", dark),
                theme === "dark",
            );
            if (theme === "dark") {
                await page.waitForFunction((previous) => {
                    const canvas = document.querySelector("canvas");
                    return canvas instanceof HTMLCanvasElement && canvas.toDataURL() !== previous;
                }, light[0]);
            }
            const figures = page.locator(".figure");
            for (let i = 0; i < (await figures.count()); i++) {
                const figure = figures.nth(i);
                await figure.scrollIntoViewIfNeeded();
                if (output) {
                    await figure.screenshot({
                        path: resolve(output, `${String(width)}-${theme}-${String(i)}.png`),
                    });
                }
                assert.equal(await figure.getAttribute("data-chart-overflow"), null);
            }
            assert.equal(
                await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
                false,
            );
        }
    }
});

void test("static chart tables preserve original values without JavaScript and fit mobile", async () => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 340, height: 900 },
    });
    try {
        const origin = await serveStaticSite(context, directory ?? "");
        const staticPage = await context.newPage();
        await staticPage.goto(new URL("/posts/build/basic-charts/", origin).href);
        const figures = staticPage.locator(".figure");
        assert.equal(await figures.count(), 10);
        const percentage = figures.nth(4);
        await percentage.locator("summary").click();
        assert.deepEqual(
            await percentage.locator("tbody tr").first().locator("th,td").allTextContents(),
            ["Read", "30", "15", "5"],
        );
        for (const details of await staticPage.locator(".figure-data").all()) {
            if ((await details.getAttribute("open")) === null) {
                await details.locator("summary").click();
            }
        }
        assert.equal(
            await staticPage.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
        );
    } finally {
        await context.close();
    }
});

void test("chart replay and a held-frame resize preserve bounds", async () => {
    await page.setViewportSize({ width: 390, height: 900 });
    await load();
    for (const index of [0, 6, 8]) {
        const figure = page.locator(".figure").nth(index);
        await figure.scrollIntoViewIfNeeded();
        const replay = figure.locator(".figure-replay");
        await page.waitForFunction(() =>
            [...document.querySelectorAll(".figure-replay")].every(
                (button) => !button.hasAttribute("hidden"),
            ),
        );
        const size = await figure.evaluate((el) => [el.clientWidth, el.clientHeight]);
        const before = await figure
            .locator("canvas")
            .evaluate((el: HTMLCanvasElement) => el.toDataURL());
        await replay.click();
        await page.waitForFunction(
            ({ i, previous }) => {
                const canvas = document.querySelectorAll(".figure canvas")[i];
                return canvas instanceof HTMLCanvasElement && canvas.toDataURL() !== previous;
            },
            { i: index, previous: before },
        );
        assert.deepEqual(await figure.evaluate((el) => [el.clientWidth, el.clientHeight]), size);
        await page.waitForFunction(
            (i) => !document.querySelectorAll(".figure-replay")[i]?.hasAttribute("hidden"),
            index,
        );
        assert.deepEqual(await figure.evaluate((el) => [el.clientWidth, el.clientHeight]), size);
    }
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForFunction(() =>
        [...document.querySelectorAll(".figure canvas")].every(
            (el) =>
                el instanceof HTMLCanvasElement &&
                el.width === Math.round(el.clientWidth * devicePixelRatio),
        ),
    );
});

void test("scene recipes and every prepared symbol render without clipped text", async () => {
    for (const width of [390, 1200]) {
        await page.setViewportSize({ width, height: 900 });
        for (const at of [0.35, 1]) {
            await page.goto(new URL(`/posts/build/scene-kit/?figure-at=${String(at)}`, base).href, {
                waitUntil: "networkidle",
            });
            await page.waitForFunction(
                () => document.querySelectorAll(".figure.is-ready").length === 14,
            );
            await page.evaluate(() => document.fonts.ready);
            if (output) {
                await page.addStyleTag({
                    content: "#back-to-top, #navbar-wrapper { visibility: hidden !important; }",
                });
            }
            for (const theme of ["light", "dark"]) {
                await page.evaluate(
                    (dark) => document.documentElement.classList.toggle("dark", dark),
                    theme === "dark",
                );
                for (const [i, figure] of (await page.locator(".figure").all()).entries()) {
                    await figure.scrollIntoViewIfNeeded();
                    if (output && (at === 1 || i < 3)) {
                        await figure.screenshot({
                            path: resolve(
                                output,
                                `scene-${String(width)}-${theme}-${String(at)}-${String(i)}.png`,
                            ),
                        });
                    }
                    assert.equal(await figure.getAttribute("data-chart-overflow"), null);
                }
                assert.equal(
                    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
                    false,
                );
            }
        }
    }
});
