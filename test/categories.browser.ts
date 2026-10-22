import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { isJsonObject, parseJson } from "../src/utils/json.ts";

let browser: Browser;
let page: Page;
let base: URL;
const errors: string[] = [];

before(async () => {
    if (process.env.CATEGORIES_BASE)
    {
        base = new URL(`${process.env.CATEGORIES_BASE.replace(/\/+$/u, "")}/`);
    }
    else {
        const lock = parseJson(
            await readFile(new URL("../.astro/dev.json", import.meta.url), "utf8"),
        );
        if (!isJsonObject(lock) || typeof lock.url !== "string")
        {
            throw new Error(
                "Serve BLOG_POSTS_DIR=./src/fixtures/categories with astro dev --background, or set CATEGORIES_BASE.",
            );
        }
        base = new URL(`${lock.url.replace(/\/+$/u, "")}/`);
    }
    browser = await chromium.launch();
    page = await browser.newPage({
        viewport: { width: 1200, height: 950 },
        reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
});
after(async () => {
    await browser.close();
    assert.deepEqual(errors, []);
});
const url = (path: string) => new URL(path.replace(/^\/+/u, ""), base).href;

const visit = async (path: string) => {
    const response = await page.goto(url(path));
    assert.equal(response?.status(), 200);
};

void test("category index and sidebar preserve the folder tree and inclusive counts", async () => {
    await visit("/categories/");
    const tree = page.locator("main > .category-tree");
    assert.equal(await tree.locator(":scope > li").count(), 3);
    const statistics = tree.locator('a[href$="/categories/statistics/"]').locator("..");
    assert.match(
        (await statistics.locator(":scope > a .category-tally").innerText()).trim(),
        /^5(?:\D|$)/u,
    );
    assert.equal(await statistics.locator(":scope > ul > li").count(), 3);
    assert.equal(
        await statistics
            .locator('a[href$="/categories/statistics/probability/continuous/"]')
            .count(),
        1,
    );
    assert.equal(
        await page.locator('#sidebar a[href$="/categories/statistics/"] .count').innerText(),
        "5",
    );
    assert.equal(
        await page
            .locator('#sidebar a[href$="/categories/statistics/probability/"] .count')
            .innerText(),
        "2",
    );
});

void test("category routes include descendants and exclude similarly named siblings", async () => {
    for (const [path, count] of [
        ["engineering", 2],
        ["statistics", 5],
        ["statistics/probability", 2],
        ["statistics/probability/continuous", 1],
        ["engineering/probability", 1],
        ["statistics-extra", 1],
    ] as const) {
        await visit(`/categories/${path}/`);
        assert.equal(await page.locator("main > .entry-list > .entry").count(), count);
        const links = await page
            .locator("main .entry-link")
            .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
        assert.ok(links.every((href) => href?.startsWith(`${base.pathname}posts/${path}/`)));
    }
    await visit("/categories/statistics/probability/continuous/");
    assert.equal(await page.locator('#sidebar .category-tree a[aria-current="page"]').count(), 1);
    assert.equal(await page.locator("#sidebar .category-tree .is-ancestor").count(), 2);
    assert.deepEqual(
        (await page.locator("main .category-breadcrumbs li").allTextContents()).map((s) =>
            s.replace(/^\s*\/\s*/u, "").trim(),
        ),
        ["Statistics", "Probability", "Continuous"],
    );
    await page
        .locator('main .category-breadcrumbs a[href$="/categories/statistics/probability/"]')
        .click();
    await page.waitForURL("**/categories/statistics/probability/");
    assert.equal(await page.locator("main > .entry-list > .entry").count(), 2);
});

void test("article breadcrumbs, metadata and Unicode links keep full ancestry", async () => {
    await visit("/posts/statistics/probability/continuous/normal/");
    assert.deepEqual(await page.locator(".post-header .category-breadcrumbs a").allTextContents(), [
        "Statistics",
        "Probability",
        "Continuous",
    ]);
    assert.match(
        await page.locator('script[type="application/ld+json"]').innerText(),
        /Statistics \/ Probability \/ Continuous/u,
    );
    await visit("/categories/");
    await page
        .locator("main .category-name")
        .filter({ hasText: /^확률과 통계$/u })
        .click();
    assert.equal((await page.locator(".page-intro h1").innerText()).trim(), "확률과 통계");
    assert.equal(await page.locator("main > .entry-list > .entry").count(), 1);
});

void test("nested lists and long names fit mobile widths with JavaScript disabled", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    const staticPage = await context.newPage();
    const shots = new URL("../.figures-shots-category-hierarchy/", import.meta.url);
    await mkdir(shots, { recursive: true });
    for (const width of [320, 390, 1200]) {
        await staticPage.setViewportSize({ width, height: 950 });
        for (const [name, path] of [
            ["index", "/categories/"],
            ["parent", "/categories/statistics/"],
            [
                "leaf",
                "/categories/engineering/longcategorynamewithoutspacesformobile/more-details/",
            ],
        ] as const) {
            assert.equal((await staticPage.goto(url(path)))?.status(), 200);
            await staticPage.evaluate(() => document.fonts.ready);
            assert.ok(
                await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                `${name} overflows at ${String(width)}`,
            );
            const sidebar = await staticPage
                .locator("#sidebar")
                .evaluate((el) => ({
                    overflow: getComputedStyle(el).overflowY,
                    height: el.clientHeight,
                    contentHeight: el.scrollHeight,
                }));
            assert.equal(sidebar.overflow, "visible");
            assert.ok(Math.abs(sidebar.height - sidebar.contentHeight) <= 1);
            await staticPage.screenshot({
                path: new URL(`${name}-${String(width)}.png`, shots).pathname,
                fullPage: true,
            });
        }
    }
    await context.close();
});
