import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { siteConfig } from "../src/config.ts";
import { languageTags, translate } from "../src/locales/index.ts";
import { isJsonObject, parseJson } from "../src/utils/json.ts";

const locale = process.env.EXPECTED_LOCALE ?? siteConfig.locale;
assert.ok(locale === "en" || locale === "ko", "EXPECTED_LOCALE must be en or ko");
const messages = {
    en: { date: "October 21, 2026", stamp: "2026 · 10 · 21", find: "Find" },
    ko: { date: "2026년 10월 21일", stamp: "2026. 10. 21.", find: "찾기" },
}[locale];
let browser: Browser;
let page: Page;
let base: URL;
const errors: string[] = [];

before(async () => {
    if (process.env.LOCALE_BASE) {
        base = new URL(`${process.env.LOCALE_BASE.replace(/\/+$/u, "")}/`);
    }
    else {
        const lock = parseJson(
            await readFile(new URL("../.astro/dev.json", import.meta.url), "utf8"),
        );
        if (!isJsonObject(lock) || typeof lock.url !== "string")
        {
            throw new Error("Start astro dev --background or set LOCALE_BASE");
        }
        base = new URL(`${lock.url.replace(/\/+$/u, "")}/`);
    }
    browser = await chromium.launch();
    page = await browser.newPage({
        viewport: { width: 1100, height: 1000 },
        reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
});
after(async () => {
    await browser.close();
    assert.deepEqual(errors, []);
});

void test("configured locale reaches navigation, document metadata and compact dates", async () => {
    await page.goto(base.href, { waitUntil: "networkidle" });
    assert.equal(await page.locator("html").getAttribute("lang"), languageTags[locale]);
    assert.equal(
        await page
            .getByRole("link", { name: translate(locale, "nav.archive"), exact: true })
            .first()
            .count(),
        1,
    );
    assert.equal(
        await page.locator('meta[property="og:locale"]').getAttribute("content"),
        languageTags[locale].replace("-", "_"),
    );
    assert.match(
        await page.locator('script[type="application/ld+json"]').innerText(),
        new RegExp(languageTags[locale], "u"),
    );
    assert.equal(
        (await page.locator('time[datetime="2026-10-21"]').first().innerText()).trim(),
        messages.stamp,
    );
    assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        new URL(base.pathname, siteConfig.url).href,
    );
});

void test("archive dates and counts localize while category folder names remain unchanged", async () => {
    await page.goto(new URL("archive/", base).href, { waitUntil: "networkidle" });
    const group = page.locator(".year-group").first();
    const year = (await group.getAttribute("id"))?.slice(1);
    assert.ok(year);
    assert.equal(
        (await group.locator(".year-number").innerText()).trim(),
        translate(locale, "date.year", { year }),
    );
    const count = await group.locator(".archive-item").count();
    assert.equal(
        (await group.locator(".year-count").innerText()).trim(),
        translate(locale, count === 1 ? "index.countOne" : "index.count", {
            count: count.toLocaleString(languageTags[locale]),
        }),
    );
    assert.ok(
        (await page.locator('.archive-day[datetime="2026-10-21"]').first().innerText()).includes(
            locale === "ko" ? "10. 21." : "10 · 21",
        ),
    );
    await page.goto(new URL("categories/", base).href, { waitUntil: "networkidle" });
    assert.equal(
        (
            await page
                .locator('.category-link[href*="/categories/build"] .category-name')
                .innerText()
        ).trim(),
        "build",
    );
    const links = await page
        .locator(".category-link")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
    assert.ok(links.every((href) => href?.startsWith(`${base.pathname}categories/`)));
});

void test("article dates and search use the locale while authored English prose stays intact", async () => {
    await page.goto(new URL("posts/build/statistical-figures/", base).href, {
        waitUntil: "networkidle",
    });
    assert.equal((await page.locator(".post-meta-date").innerText()).trim(), messages.date);
    assert.equal(await page.locator(".post-meta-date").getAttribute("datetime"), "2026-10-21");
    assert.equal(
        (await page.locator(".post-title").innerText()).trim(),
        "How to read thirty statistical figures",
    );
    assert.ok((await page.locator(".post-body").innerText()).includes("A mean cannot show"));
    assert.equal(
        (await page.locator(".comments-title").first().textContent())?.trim(),
        translate(locale, "comments.title"),
    );
    assert.equal(await page.locator("#comment-form").getAttribute("data-lang"), locale);
    const results = await page.evaluate(async (url) => {
        // Import the built search API without introducing it as a source dependency.
        const module = (await import(url)) as {
            search: (
                query: string,
            ) => Promise<{ results: { data: () => Promise<{ url: string }> }[] }>;
        };
        const found = await module.search("Kaplan");
        return Promise.all(found.results.map(async (result) => (await result.data()).url));
    }, new URL("pagefind/pagefind.js", base).href);
    assert.ok(results.some((url) => url.includes("/posts/build/statistical-figures/")));
});

void test("localized replay controls retain the same figure geometry throughout playback", async () => {
    await page.setViewportSize({ width: 390, height: 1000 });
    const figure = page.locator(".figure.is-ready").first();
    const replay = figure.getByRole("button", {
        name: translate(locale, "figure.replay"),
        exact: true,
    });
    await replay.waitFor({ state: "visible" });
    const size = () =>
        figure.evaluate((root) => {
            const box = root.getBoundingClientRect();
            return { width: box.width, height: box.height };
        });
    await page.evaluate(() => document.fonts.ready);
    const finished = await size();
    await replay.click();
    await figure.locator(".figure-replay").waitFor({ state: "hidden" });
    assert.deepEqual(await size(), finished);
    await replay.waitFor({ state: "visible", timeout: 15_000 });
    assert.deepEqual(await size(), finished);
});

void test("playground execution and find panel follow the locale with author-defined grammars", async () => {
    await page.goto(new URL("posts/build/browser-code/", base).href, { waitUntil: "networkidle" });
    const editor = page.locator('[data-code-playground][data-ready="true"]').first();
    await editor.waitFor();
    assert.equal(
        (await editor.locator(".playground-run").innerText()).trim(),
        translate(locale, "playground.run"),
    );
    await editor.locator(".playground-run").click();
    await page.waitForFunction(
        () =>
            document.querySelector("[data-code-playground]")?.getAttribute("data-run-state") ===
            "done",
    );
    assert.equal(
        (await editor.locator(".playground-status").innerText()).trim(),
        translate(locale, "playground.done"),
    );
    assert.match(await editor.locator(".playground-output").innerText(), /Mean:/u);
    await editor.locator(".cm-content").press("Control+f");
    await editor.getByRole("textbox", { name: messages.find, exact: true }).waitFor();
    await editor.getByRole("textbox", { name: messages.find, exact: true }).press("Escape");
    assert.equal(await editor.locator('input[type="file"]').count(), 0);
    assert.equal(await editor.locator(".playground-highlight-status").isVisible(), false);
    const overflow = await editor.evaluate(
        (element) => element.getBoundingClientRect().right > innerWidth,
    );
    assert.equal(overflow, false);
});
