import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";

interface ObserverRecord {
    emit: () => void;
    disconnects: number;
}

interface ContentsHarness {
    observers: ObserverRecord[];
    frames: Map<number, FrameRequestCallback>;
    flush: () => void;
}

declare global {
    interface Window {
        mountContentsForTest: () => void;
        contentsHarness: ContentsHarness;
    }
}

let browser: Browser;
let source: string;
const errors: string[] = [];
const slugs = ["alpha", "beta", "gamma"];
const links = (rail: boolean) =>
    slugs
        .map(
            (slug) =>
                `<li><a ${rail ? 'class="contents-item"' : ""} data-slug="${slug}" href="#${slug}">${slug}</a></li>`,
        )
        .join("");
const fixture = `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width">
<style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px sans-serif; }
    header { height: 120px; }
    #contents { position: fixed; right: 0; top: 0; }
    .contents-inline { margin-bottom: 40px; }
    .contents-inline-list { margin: 0; padding: 80px 40px; }
    .contents-inline-list a { display: block; padding: 18px 0; }
    h2, h3 { margin: 0; height: 40px; scroll-margin-top: 48px; }
    .prose { height: 600px; }
    @media (max-width: 600px) { #contents { display: none; } }
</style></head><body>
<header>Article</header>
<nav id="contents"><ol>${links(true)}</ol></nav>
<details class="contents-inline" open><summary>Contents</summary>
<ol class="contents-inline-list">${links(false)}</ol></details>
<main><section id="section-alpha"><h2 id="alpha">Alpha</h2><div class="prose"></div>
<section id="section-beta"><h3 id="beta">Beta</h3><div class="prose"></div></section>
</section><section id="section-gamma"><h2 id="gamma">Gamma</h2>
<div class="prose"></div><div class="prose"></div></section></main>
<script type="module">
    import { mountContents } from "/contents.js";
    window.mountContentsForTest = mountContents;
    mountContents();
    document.documentElement.dataset.ready = "true";
</script></body></html>`;

before(async () => {
    const input = await readFile(new URL("../src/scripts/contents.ts", import.meta.url), "utf8");
    source = ts.transpileModule(input, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    browser = await chromium.launch();
});

after(async () => {
    await browser.close();
    assert.deepEqual(errors, []);
});

async function openFixture(controlled = false): Promise<Page> {
    const page = await browser.newPage({
        viewport: { width: 390, height: 800 },
        reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://contents.test/**", async (route) => {
        const script = new URL(route.request().url()).pathname === "/contents.js";
        await route.fulfill({
            status: 200,
            contentType: script ? "text/javascript" : "text/html",
            body: script ? source : fixture,
        });
    });
    if (controlled) {
        await page.addInitScript(() => {
            const frames = new Map<number, FrameRequestCallback>();
            let nextFrame = 1;
            window.requestAnimationFrame = (callback) => {
                const id = nextFrame++;
                frames.set(id, callback);
                return id;
            };
            window.cancelAnimationFrame = (id) => frames.delete(id);
            const observers: ObserverRecord[] = [];
            window.contentsHarness = {
                observers,
                frames,
                flush: () => {
                    const pending = [...frames.values()];
                    frames.clear();
                    pending.forEach((callback) => {
                        callback(performance.now());
                    });
                },
            };
            window.IntersectionObserver = class implements IntersectionObserver {
                readonly root = null;
                readonly rootMargin = "0px";
                readonly scrollMargin = "0px";
                readonly thresholds = [0];
                readonly record: ObserverRecord;

                constructor(callback: IntersectionObserverCallback) {
                    this.record = {
                        disconnects: 0,
                        emit: () => {
                            const target = document.getElementById("section-beta");
                            if (!target) throw new Error("Missing section");
                            const rect = target.getBoundingClientRect();
                            callback(
                                [
                                    {
                                        target,
                                        boundingClientRect: rect,
                                        intersectionRect: rect,
                                        rootBounds: null,
                                        intersectionRatio: 1,
                                        isIntersecting: true,
                                        time: performance.now(),
                                    },
                                ],
                                this,
                            );
                        },
                    };
                    observers.push(this.record);
                }

                observe() {
                    /* Entries are delivered explicitly by the test. */
                }
                unobserve() {
                    /* There are no native observations to remove. */
                }
                takeRecords(): IntersectionObserverEntry[] {
                    return [];
                }
                disconnect() {
                    this.record.disconnects++;
                }
            };
        });
    }
    await page.goto("https://contents.test/article/");
    await page.waitForFunction(() => document.documentElement.dataset.ready === "true", undefined, {
        polling: 20,
    });
    return page;
}

void test("mobile keyboard navigation closes the outline before jumping and focuses the heading", async (t) => {
    const page = await openFixture();
    t.after(() => page.close());
    for (const slug of ["beta", "alpha", "gamma"]) {
        await page.locator("details").evaluate((details: HTMLDetailsElement) => {
            details.open = true;
        });
        await page.locator(`.contents-inline-list a[href="#${slug}"]`).focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(`**/article/#${slug}`);
        assert.equal(await page.locator("details").getAttribute("open"), null);
        assert.equal(await page.evaluate(() => document.activeElement?.id), slug);
        const top = await page
            .locator(`#${slug}`)
            .evaluate((heading) => heading.getBoundingClientRect().top);
        assert.ok(Math.abs(top - 48) <= 1, `Heading ${slug} landed at ${String(top)}`);
        await page.waitForFunction((current) => {
            const active = [...document.querySelectorAll('[aria-current="location"]')];
            return (
                active.length === 2 &&
                active.every((link) => link.getAttribute("data-slug") === current)
            );
        }, slug);
        for (const selector of ["#contents", ".contents-inline-list"]) {
            assert.equal(await page.locator(`${selector} .is-active`).count(), 1);
        }
    }
});

void test("modified activations leave the outline and keyboard focus alone", async (t) => {
    const page = await openFixture();
    t.after(() => page.close());
    const results = await page.evaluate(() => {
        const link = document.querySelector<HTMLAnchorElement>(
            '.contents-inline-list a[href="#beta"]',
        );
        const details = document.querySelector("details");
        if (!link || !details) throw new Error("Missing outline");
        link.focus();
        link.addEventListener("click", (event) => {
            event.preventDefault();
        });
        return [
            { ctrlKey: true },
            { metaKey: true },
            { shiftKey: true },
            { altKey: true },
            { button: 1 },
        ].map((modifier) => {
            link.dispatchEvent(
                new MouseEvent("click", { ...modifier, bubbles: true, cancelable: true }),
            );
            return { open: details.open, focus: document.activeElement === link };
        });
    });
    assert.ok(results.every(({ open, focus }) => open && focus));
    assert.equal(new URL(page.url()).hash, "");
});

void test("remount replaces listeners and swapping cancels pending paints and navigation hooks", async (t) => {
    const page = await openFixture(true);
    t.after(() => page.close());
    const result = await page.evaluate(() => {
        const link = document.querySelector<HTMLAnchorElement>(
            '.contents-inline-list a[href="#beta"]',
        );
        const heading = document.getElementById("beta");
        const details = document.querySelector("details");
        if (!link || !heading || !details) throw new Error("Missing outline");
        let focusCalls = 0;
        const focus = heading.focus.bind(heading);
        heading.focus = (options) => {
            focusCalls++;
            focus(options);
        };
        link.addEventListener("click", (event) => {
            event.preventDefault();
        });
        window.mountContentsForTest();
        link.click();
        const mounted = { focusCalls, open: details.open };
        const harness = window.contentsHarness;
        harness.observers[1]?.emit();
        const pending = harness.frames.size;
        document.dispatchEvent(new Event("astro:before-swap"));
        const cancelled = harness.frames.size;
        details.open = true;
        link.click();
        harness.flush();
        return {
            mounted,
            pending,
            cancelled,
            disconnects: harness.observers.map((observer) => observer.disconnects),
            afterSwap: { focusCalls, open: details.open },
        };
    });
    assert.deepEqual(result, {
        mounted: { focusCalls: 1, open: false },
        pending: 1,
        cancelled: 0,
        disconnects: [1, 1],
        afterSwap: { focusCalls: 1, open: true },
    });
});
