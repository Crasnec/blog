import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test, type TestContext } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";

let browser: Browser;
const compiled: Record<string, string> = {};

before(async () => {
    const modules = [
        ["/ui.js", "scripts/ui.ts"],
        ...[
            "lifecycle",
            "theme",
            "scroll",
            "navigation",
            "enhancements",
            "search/dialog",
            "search/engine",
        ].map((name) => [`/site/${name}`, `site/${name}.ts`]),
    ];
    for (const [url, file] of modules) {
        if (!url || !file) {
            throw new Error("Invalid browser fixture module");
        }
        const source = await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
        compiled[url] = `import.meta.env = { BASE_URL: "/" };\n${
            ts.transpileModule(source, {
                compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
            }).outputText
        }`;
    }
    browser = await chromium.launch();
});

after(async () => {
    await browser.close();
});

const markup = `<!doctype html>
<html><body>
    <header><button id="search-open">Search</button></header>
    <main><a id="background-link" href="#background">Background link</a></main>
    <aside id="already-inert" inert><button>Unavailable control</button></aside>
    <div id="search-panel" role="dialog" aria-modal="true" aria-label="Search"
        data-empty="Nothing found." data-loading="Loading the index"
        data-unavailable="Search is unavailable right now. Please try again." hidden>
        <input id="search-input" type="search" aria-label="Search posts">
        <button id="search-close">Close</button>
        <ul id="search-results"></ul>
        <p id="search-note" role="status" hidden></p>
    </div>
    <script type="module">
        import "/ui.js";
        document.dispatchEvent(new Event("astro:page-load"));
    </script>
</body></html>`;

const pagefindScript = `
    export const options = async () => {};
    export async function search(query) {
        if (query === "broken-search") throw new Error("Search request failed");
        if (query === "slow" || query === "late-error") {
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        if (query === "late-error") throw new Error("Old request failed");
        return {
            results: query === "empty" ? [] : Array.from({ length: 3 }, (_, index) => ({
                data: async () => {
                    if (query === "broken-data") throw new Error("Result request failed");
                    return {
                        url: "#result-" + index,
                        meta: { title: query + " result " + index },
                        excerpt: "Text with a <mark>match</mark>",
                    };
                },
            })),
        };
    }
`;

async function mount(context: TestContext, engine = pagefindScript): Promise<Page> {
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    context.after(async () => {
        await browserContext.close();
        assert.deepEqual(errors, [], "The search panel must handle rejected requests");
    });

    // Every request is fulfilled in memory; no development or HTTP server is started.
    await browserContext.route("**/*", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const scripts: Record<string, string> = {
            ...compiled,
            "/consts": "export const NAVBAR_HEIGHT = 64;",
            "/strings": "export const t = key => key;",
            "/pagefind/pagefind.js": engine,
        };
        const script = scripts[path];
        if (path === "/") {
            await route.fulfill({ contentType: "text/html", body: markup });
        } else if (script !== undefined) {
            await route.fulfill({ contentType: "text/javascript", body: script });
        } else {
            errors.push(`Unexpected request: ${path}`);
            await route.fulfill({ status: 404, body: "" });
        }
    });
    await page.goto("https://search.test/", { waitUntil: "networkidle" });
    return page;
}

async function openSearch(page: Page) {
    await page.locator("#search-open").click();
    await page.waitForFunction(() => document.activeElement?.id === "search-input");
}

async function findResults(page: Page, query = "statistics") {
    await page.locator("#search-input").fill(query);
    await page.waitForFunction(
        (text) => document.querySelector("#search-results a")?.textContent.startsWith(text),
        query,
    );
}

void test("search contains keyboard focus and restores preexisting inert state", async (context) => {
    const page = await mount(context);
    await openSearch(page);
    assert.equal(await page.locator("main").getAttribute("inert"), "");
    await page.keyboard.press("Shift+Tab");
    assert.equal(
        await page.locator("#search-close").evaluate((el) => el === document.activeElement),
        true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
        await page.locator("#search-input").evaluate((el) => el === document.activeElement),
        true,
    );

    await findResults(page);
    await page.keyboard.press("Shift+Tab");
    assert.equal(
        await page
            .locator("#search-results a")
            .last()
            .evaluate((el) => el === document.activeElement),
        true,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowDown");
    assert.equal(
        await page
            .locator("#search-results a")
            .first()
            .evaluate((el) => el === document.activeElement),
        true,
    );
    await page.keyboard.press("Escape");
    assert.equal(
        await page.locator("#search-open").evaluate((el) => el === document.activeElement),
        true,
    );
    assert.equal(await page.locator("main").getAttribute("inert"), null);
    assert.equal(await page.locator("#already-inert").getAttribute("inert"), "");
    assert.equal(await page.locator("#search-panel").getAttribute("inert"), "");
    await page.keyboard.press("Tab");
    assert.equal(
        await page.locator("#background-link").evaluate((el) => el === document.activeElement),
        true,
    );
});

void test("IME confirmation does not navigate or close the search panel", async (context) => {
    const page = await mount(context);
    await openSearch(page);
    await findResults(page, "통계");
    const input = page.locator("#search-input");
    for (const key of ["Enter", "Escape", "ArrowDown"]) {
        await input.dispatchEvent("keydown", { key, isComposing: true, bubbles: true });
    }
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(await input.evaluate((el) => el === document.activeElement), true);
    assert.equal(await page.locator("#search-panel").getAttribute("class"), "is-open");
    await input.press("Enter");
    assert.equal(new URL(page.url()).hash, "#result-0");
});

void test("closing and immediately reopening keeps the panel open", async (context) => {
    const page = await mount(context);
    await openSearch(page);
    await page.evaluate(() => {
        document.getElementById("search-close")?.click();
        document.getElementById("search-open")?.click();
    });
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#search-panel").isVisible(), true);
    assert.equal(
        await page.locator("#search-input").evaluate((el) => el === document.activeElement),
        true,
    );
    await page.keyboard.press("Escape");
    await page.locator("#search-panel").waitFor({ state: "hidden" });
});

void test("Ctrl+K opens search and an Astro swap releases modal state", async (context) => {
    const page = await mount(context);
    await page.keyboard.press("Control+k");
    await page.waitForFunction(() => document.activeElement?.id === "search-input");
    await page.locator("#search-input").fill("slow");
    await page.evaluate(() => {
        document.dispatchEvent(new Event("astro:before-swap"));
        document.getElementById("search-panel")?.remove();
    });
    assert.equal(await page.locator("main").getAttribute("inert"), null);
    await page.waitForTimeout(200);
    await page.locator("#background-link").focus();
    assert.equal(
        await page.locator("#background-link").evaluate((el) => el === document.activeElement),
        true,
    );
});

void test("search failures show an error and the next query can recover", async (context) => {
    const page = await mount(context);
    await openSearch(page);
    for (const query of ["broken-search", "broken-data"]) {
        await findResults(page);
        await page.locator("#search-input").fill(query);
        await page.waitForFunction(() =>
            document.getElementById("search-note")?.textContent.startsWith("Search is unavailable"),
        );
        assert.equal(await page.locator("#search-results a").count(), 0);
    }
    await findResults(page, "recovered");
    assert.equal(await page.locator("#search-note").isVisible(), false);
    await page.locator("#search-input").fill("late-error");
    await findResults(page, "latest");
    await page.waitForTimeout(200);
    assert.match(await page.locator("#search-results").innerText(), /latest result/u);
    assert.equal(await page.locator("#search-note").isVisible(), false);
});

void test("a failed Pagefind setup can retry on a later query", async (context) => {
    const page = await mount(
        context,
        pagefindScript.replace(
            "export const options = async () => {};",
            `export const options = async () => {
                if (document.getElementById("search-input").value !== "retry") {
                    throw new Error("Index temporarily unavailable");
                }
            };`,
        ),
    );
    await openSearch(page);
    await page.locator("#search-input").fill("first");
    await page.waitForFunction(() =>
        document.getElementById("search-note")?.textContent.startsWith("Search is unavailable"),
    );
    await findResults(page, "retry");
});

void test("malformed search payloads fail visibly and a valid query recovers", async (context) => {
    const engine = pagefindScript.replace(
        "export async function search(query) {",
        `export async function search(query) {
            const malformed = {
                "response-null": null,
                "results-object": { results: {} },
                "reference-null": { results: [null] },
                "reference-method": { results: [{ data: 1 }] },
                "data-null": { results: [{ data: async () => null }] },
                "url-number": { results: [{ data: async () => ({ url: 1 }) }] },
                "url-empty": { results: [{ data: async () => ({ url: " " }) }] },
                "url-script": { results: [{ data: async () => ({ url: "javascript:void(0)" }) }] },
                "meta-null": { results: [{ data: async () => ({ url: "/", meta: null }) }] },
                "title-object": { results: [{
                    data: async () => ({ url: "/", meta: { title: {} } })
                }] },
                "excerpt-object": { results: [{ data: async () => ({ url: "/", excerpt: {} }) }] }
            };
            if (Object.hasOwn(malformed, query)) return malformed[query];`,
    );
    const page = await mount(context, engine);
    await openSearch(page);
    for (const query of [
        "response-null",
        "results-object",
        "reference-null",
        "reference-method",
        "data-null",
        "url-number",
        "url-empty",
        "url-script",
        "meta-null",
        "title-object",
        "excerpt-object",
    ]) {
        await page.locator("#search-input").fill(query);
        await page.waitForFunction(() =>
            document.getElementById("search-note")?.textContent.startsWith("Search is unavailable"),
        );
        assert.equal(await page.locator("#search-results a").count(), 0, query);
    }
    await findResults(page, "recovered");
});

void test("site controls bind to each new document without duplicating shortcuts", async (context) => {
    const page = await mount(context);
    const body = markup.slice(
        markup.indexOf("<body>") + 6,
        markup.indexOf('<script type="module">'),
    );
    for (let navigation = 0; navigation < 3; navigation++) {
        await openSearch(page);
        await page.evaluate((html) => {
            document.dispatchEvent(new Event("astro:before-swap"));
            document.body.innerHTML = html;
            document.dispatchEvent(new Event("astro:after-swap"));
            document.dispatchEvent(new Event("astro:page-load"));
            const button = document.getElementById("search-open");
            button?.addEventListener("click", () => {
                button.dataset.clicks = String(Number(button.dataset.clicks ?? "0") + 1);
            });
        }, body);
        await page.keyboard.press("Control+k");
        await page.waitForFunction(() => document.activeElement?.id === "search-input");
        assert.equal(await page.locator("#search-open").getAttribute("data-clicks"), "1");
        assert.equal(await page.locator("main").getAttribute("inert"), "");
        assert.equal(await page.locator("html").getAttribute("data-navigated"), "true");
        await findResults(page, `navigation-${String(navigation)}`);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("main").getAttribute("inert"), null);
        assert.equal(await page.locator("#already-inert").getAttribute("inert"), "");
    }
});

void test("navigation cancels a reading feature whose module is still loading", async (context) => {
    const page = await mount(context);
    const { promise: gate, resolve: release } = Promise.withResolvers<undefined>();
    const started = page.waitForRequest("**/site/contents");
    await page.route("**/site/contents", async (route) => {
        await gate;
        await route.fulfill({
            contentType: "text/javascript",
            body: `
                document.documentElement.dataset.featureLoaded = "true";
                export function mountContents() {
                    document.documentElement.dataset.staleFeatureMounted = "true";
                }
            `,
        });
    });
    try {
        await page.evaluate(() => {
            const contents = document.createElement("nav");
            contents.id = "contents";
            document.body.append(contents);
            document.dispatchEvent(new Event("astro:page-load"));
        });
        await started;
        await page.evaluate(() => {
            document.dispatchEvent(new Event("astro:before-swap"));
            document.getElementById("contents")?.remove();
        });
    } finally {
        release(undefined);
    }
    await page.waitForFunction(() => document.documentElement.dataset.featureLoaded === "true");
    assert.equal(await page.locator("html").getAttribute("data-stale-feature-mounted"), null);
});
