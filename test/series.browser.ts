import assert from "node:assert/strict";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const dist = resolve(
    process.env.SERIES_DIST ?? fileURLToPath(new URL("../dist/", import.meta.url)),
);
const shots = new URL("../.figures-shots-series/", import.meta.url);
const origin = "https://series.test";
const errors: string[] = [];
const contentTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

interface SeriesPart {
    href: string;
    order: number;
}

interface Series {
    href: string;
    name: string;
    parts: SeriesPart[];
}

let browser: Browser;
let page: Page;
const series: Series[] = [];

async function contextWithBuild(javaScriptEnabled = true): Promise<BrowserContext> {
    const context = await browser.newContext({
        javaScriptEnabled,
        viewport: { width: 1200, height: 950 },
        reducedMotion: "reduce",
    });
    context.on("page", (opened) => {
        opened.on("pageerror", (error) => errors.push(error.message));
    });
    // Serve the production files directly to Chromium; no local server is needed.
    await context.route("**/*", async (route) => {
        try {
            const url = new URL(route.request().url());
            assert.equal(url.origin, origin);
            let file = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
            assert.ok(file === dist || file.startsWith(`${dist}${sep}`));
            if ((await stat(file)).isDirectory()) {
                file = join(file, "index.html");
            }
            await route.fulfill({
                contentType: contentTypes[extname(file)] ?? "application/octet-stream",
                body: await readFile(file),
            });
        } catch {
            await route.fulfill({ status: 404, body: "Not found" });
        }
    });
    return context;
}

async function visit(target: Page, href: string) {
    assert.equal((await target.goto(new URL(href, origin).href))?.status(), 200);
    await target.evaluate(() => document.fonts.ready);
}

before(async () => {
    await stat(join(dist, "series", "index.html"));
    await mkdir(shots, { recursive: true });
    browser = await chromium.launch();
    const context = await contextWithBuild();
    page = await context.newPage();
    await visit(page, "/series/");
    const links = await page.locator("main .category-list .category-link").evaluateAll((items) =>
        items.map((item) => ({
            href: item.getAttribute("href") ?? "",
            name: item.querySelector(".category-name")?.textContent.trim() ?? "",
        })),
    );
    assert.ok(links.length > 0, "Build content containing a series before running this suite.");
    for (const link of links) {
        assert.ok(link.href && link.name);
        await visit(page, link.href);
        const parts = await page.locator("main .entry-link").evaluateAll((items) =>
            items.map((item) => ({
                href: item.getAttribute("href") ?? "",
                order: Number(
                    item.querySelector(".entry-series")?.textContent.match(/\d+/gu)?.at(-1),
                ),
            })),
        );
        series.push({ ...link, parts });
    }
});

after(async () => {
    await browser.close();
    assert.deepEqual(errors, [], "Published series pages must not raise browser errors.");
});

void test("series listings preserve author order and link every chapter", async () => {
    for (const group of series) {
        await visit(page, group.href);
        assert.equal((await page.locator("main h1").innerText()).trim(), group.name);
        assert.ok(group.parts.length > 0);
        assert.equal(new Set(group.parts.map(({ href }) => href)).size, group.parts.length);
        const order = group.parts.map((part) => part.order);
        assert.ok(order.every((value) => Number.isSafeInteger(value) && value > 0));
        assert.equal(new Set(order).size, order.length);
        assert.deepEqual(
            order,
            [...order].sort((a, b) => a - b),
        );
    }
    if (process.env.SERIES_EXPECTED_PARTS) {
        assert.equal(series[0]?.parts.length, Number(process.env.SERIES_EXPECTED_PARTS));
    }
    if (process.env.SERIES_EXPECT_HOME_PREFIX) {
        await visit(page, "/");
        const count = Number(process.env.SERIES_EXPECT_HOME_PREFIX);
        const home = await page
            .locator("main .entry-link")
            .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
        assert.deepEqual(
            home.slice(0, count),
            series[0]?.parts.slice(0, count).map((part) => part.href),
        );
    }
});

void test("chapter navigation and current markers follow each series", async () => {
    for (const group of series) {
        for (const index of [...new Set([0, 1, group.parts.length - 1])]) {
            const part = group.parts[index];
            if (!part) {
                continue;
            }
            await visit(page, part.href);
            const contents = page.locator(".series-contents");
            assert.equal(await contents.getAttribute("aria-label"), group.name);
            assert.equal(await contents.locator(".series-name").getAttribute("href"), group.href);
            const listed = await contents
                .locator(".series-parts a")
                .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
            assert.deepEqual(
                listed,
                group.parts.map((item) => item.href),
            );
            const current = contents.locator('[aria-current="page"]');
            assert.equal(await current.count(), 1);
            assert.equal(await current.getAttribute("href"), part.href);
            for (const [direction, neighbour] of [
                ["prev", group.parts[index - 1]],
                ["next", group.parts[index + 1]],
            ] as const) {
                const link = page.locator(`.post-nav a[rel="${direction}"]`);
                assert.equal(await link.count(), neighbour ? 1 : 0);
                if (neighbour) {
                    assert.equal(await link.getAttribute("href"), neighbour.href);
                }
            }
        }
    }
});

void test("series contents work by keyboard without JavaScript and fit narrow screens", async () => {
    const context = await contextWithBuild(false);
    try {
        const staticPage = await context.newPage();
        const group = series[0];
        assert.ok(group);
        const first = group.parts[0];
        assert.ok(first);
        for (const width of [320, 390, 1200]) {
            await staticPage.setViewportSize({ width, height: 950 });
            for (const [name, href] of [
                ["index", "/series/"],
                ["list", group.href],
                ["article", first.href],
            ] as const) {
                await visit(staticPage, href);
                if (name === "article") {
                    await staticPage.locator(".series-contents summary").focus();
                    await staticPage.keyboard.press("Enter");
                    assert.equal(
                        await staticPage.locator(".series-contents details").getAttribute("open"),
                        "",
                    );
                }
                assert.ok(
                    await staticPage.evaluate(
                        () => document.documentElement.scrollWidth <= window.innerWidth,
                    ),
                    `${name} overflows at ${String(width)}px`,
                );
                await staticPage.screenshot({
                    path: new URL(`${name}-${String(width)}.png`, shots).pathname,
                });
                if (name === "article") {
                    await staticPage.locator(".series-contents").screenshot({
                        path: new URL(`contents-${String(width)}.png`, shots).pathname,
                    });
                }
            }
        }
        const second = group.parts[1];
        if (second) {
            const link = staticPage.locator(".series-parts a").nth(1);
            await link.focus();
            await staticPage.keyboard.press("Enter");
            await staticPage.waitForURL(new URL(second.href, origin).href);
        }
    } finally {
        await context.close();
    }
});

void test("sidebar navigation cannot select text and remains keyboard operable", async () => {
    await page.setViewportSize({ width: 1200, height: 950 });
    await visit(page, "/");
    for (const selector of ["#sidebar", "#sidebar .category-tree a", "#navbar-wrapper"]) {
        const element = page.locator(selector).first();
        assert.equal(await element.evaluate((node) => getComputedStyle(node).userSelect), "none");
    }
    for (const selector of ["#sidebar .category-tree a", "#sidebar img", ".navbar-mark"]) {
        const element = page.locator(selector).first();
        assert.equal(
            await element.evaluate((node) =>
                getComputedStyle(node).getPropertyValue("-webkit-user-drag"),
            ),
            "none",
        );
        assert.equal(
            await element.evaluate((node) => {
                const event = new DragEvent("dragstart", { bubbles: true, cancelable: true });
                node.dispatchEvent(event);
                return event.defaultPrevented;
            }),
            true,
        );
    }
    const sidebar = await page.locator("#sidebar").evaluate((element) => ({
        overflow: getComputedStyle(element).overflowY,
        height: element.clientHeight,
        contentHeight: element.scrollHeight,
    }));
    assert.equal(sidebar.overflow, "visible");
    assert.ok(Math.abs(sidebar.height - sidebar.contentHeight) <= 1);
    const link = page.locator("#sidebar .category-tree a").first();
    const href = await link.getAttribute("href");
    assert.ok(href);
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(new URL(href, origin).href);
    const first = series[0]?.parts[0];
    assert.ok(first);
    await visit(page, first.href);
    assert.notEqual(
        await page.locator(".prose").evaluate((element) => getComputedStyle(element).userSelect),
        "none",
    );
    assert.equal(
        await page
            .locator(".prose a")
            .first()
            .evaluate((element) => {
                const event = new DragEvent("dragstart", { bubbles: true, cancelable: true });
                element.dispatchEvent(event);
                return event.defaultPrevented;
            }),
        false,
    );
});
