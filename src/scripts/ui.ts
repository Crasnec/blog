/**
 * Site chrome: theme, navbar, back-to-top, search, and the lazy hand-off to the
 * contents rail, the comment form and the diagram renderer.
 *
 * Everything re-binds on `astro:page-load`, which fires on first load and after
 * every view transition. Listeners that hang off `window` or `document` are
 * registered once and read their targets from module state, so navigating
 * twenty times does not leave twenty scroll handlers behind.
 */

import { NAVBAR_HEIGHT } from "../consts";
import { t } from "../strings";

type ThemeMode = "light" | "dark" | "auto";
const ORDER: ThemeMode[] = ["light", "dark", "auto"];

const isThemeMode = (value: string | undefined): value is ThemeMode =>
    value === "light" || value === "dark" || value === "auto";

let navbar: HTMLElement | null = null;
let backToTop: HTMLElement | null = null;
let globalsWired = false;

/* — theme ————————————————————————————————————— */

function applyTheme(mode: ThemeMode) {
    const dark =
        mode === "dark" ||
        (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = mode;
    localStorage.setItem("theme", mode);

    // Which mode is active is carried by the icon, which a screen reader cannot
    // see, so the label has to say it.
    const toggle = document.getElementById("theme-toggle");
    const name = toggle?.dataset[mode];
    if (toggle && name) {
        const action = toggle.dataset.action ?? t("action.theme");
        toggle.setAttribute("aria-label", `${action}: ${name}`);
    }

    // Diagrams are rendered with baked-in colours, so they need redrawing.
    document.dispatchEvent(new CustomEvent("theme:change", { detail: { dark } }));
}

function cycleTheme() {
    const stored = document.documentElement.dataset.theme;
    const current = isThemeMode(stored) ? stored : "auto";
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "auto";
    applyTheme(next);
}

/* — scroll ————————————————————————————————————— */

function onScroll() {
    const y = window.scrollY;

    // The navbar only grows a backdrop once it has left the masthead.
    navbar?.classList.toggle("is-detached", y > NAVBAR_HEIGHT * 0.5);

    backToTop?.classList.toggle("is-hidden", y < window.innerHeight * 0.6);
}

/* — search ————————————————————————————————————— */

interface PagefindResult {
    url: string;
    meta?: { title?: string };
    excerpt?: string;
}

interface Pagefind {
    options?: (options: { excerptLength: number }) => Promise<void>;
    search: (q: string) => Promise<object | null | undefined>;
}

interface PagefindReference {
    data: () => Promise<object | null | undefined>;
}

function isPagefindReference(value: object): value is PagefindReference {
    return "data" in value && typeof value.data === "function";
}

function readPagefindReferences(value: object | null | undefined): PagefindReference[] {
    if (typeof value !== "object" || value === null || !("results" in value)) {
        throw new TypeError("Invalid Pagefind search response");
    }
    if (!Array.isArray(value.results)) {
        throw new TypeError("Invalid Pagefind result list");
    }
    return value.results.map((entry: object | null | undefined) => {
        if (typeof entry !== "object" || entry === null || !isPagefindReference(entry)) {
            throw new TypeError("Invalid Pagefind result reference");
        }
        return entry;
    });
}

function readPagefindResult(value: object | null | undefined): PagefindResult {
    if (
        typeof value !== "object" ||
        value === null ||
        !("url" in value) ||
        typeof value.url !== "string" ||
        !value.url.trim()
    ) {
        throw new TypeError("Invalid Pagefind result URL");
    }
    const url = new URL(value.url, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new TypeError("Invalid Pagefind result URL protocol");
    }
    const result: PagefindResult = { url: value.url };
    if ("meta" in value && value.meta !== undefined) {
        const meta = value.meta;
        if (typeof meta !== "object" || meta === null) {
            throw new TypeError("Invalid Pagefind result metadata");
        }
        if ("title" in meta && meta.title !== undefined) {
            if (typeof meta.title !== "string")
            {
                throw new TypeError("Invalid Pagefind result title");
            }
            result.meta = { title: meta.title };
        }
    }
    if ("excerpt" in value && value.excerpt !== undefined) {
        if (typeof value.excerpt !== "string")
        {
            throw new TypeError("Invalid Pagefind result excerpt");
        }
        result.excerpt = value.excerpt;
    }
    return result;
}

function isPagefind(value: object): value is Pagefind {
    return (
        "search" in value &&
        typeof value.search === "function" &&
        (!("options" in value) ||
            value.options === undefined ||
            typeof value.options === "function")
    );
}

let pagefind: Pagefind | null = null;
let pagefindLoading: Promise<Pagefind | null> | null = null;

async function loadPagefind(): Promise<Pagefind | null> {
    if (pagefind) {
        return pagefind;
    }
    if (pagefindLoading) {
        return pagefindLoading;
    }
    pagefindLoading = (async () => {
        try {
            const url = `${import.meta.env.BASE_URL}pagefind/pagefind.js`.replace("//", "/");
            // An ECMAScript module namespace is always an object. Its callable surface
            // is still checked below before it reaches application code.
            const loaded = (await import(/* @vite-ignore */ url)) as object;
            if (!isPagefind(loaded)) {
                throw new TypeError("Invalid Pagefind module");
            }
            await loaded.options?.({ excerptLength: 24 });
            pagefind = loaded;
            return pagefind;
        } catch {
            // The index only exists after `astro build`; in dev this is expected.
            return null;
        } finally {
            pagefindLoading = null;
        }
    })();
    return pagefindLoading;
}

function wireSearch() {
    const panel = document.getElementById("search-panel");
    const openBtn = document.getElementById("search-open");
    const closeBtn = document.getElementById("search-close");
    const input = document.getElementById("search-input");
    const list = document.getElementById("search-results");
    const note = document.getElementById("search-note");
    if (!panel || !openBtn || !(input instanceof HTMLInputElement) || !list || !note) {
        return;
    }

    const emptyText = panel.dataset.empty ?? "";
    const loadingText = panel.dataset.loading ?? "";
    const unavailableText = panel.dataset.unavailable ?? t("search.unavailable");
    let lastFocused: HTMLElement | null = null;
    let openFrame = 0;
    let closeTimer = 0;
    let active = false;
    let token = 0;
    const background = new Map<HTMLElement, boolean>();

    const hits = () => [...list.querySelectorAll<HTMLAnchorElement>("a")];

    const setExcerpt = (target: HTMLElement, source: string) => {
        const template = document.createElement("template");
        template.innerHTML = source;

        for (const element of template.content.querySelectorAll("*")) {
            if (element.tagName === "MARK") {
                for (const attribute of [...element.attributes]) {
                    element.removeAttribute(attribute.name);
                }
                continue;
            }
            element.replaceWith(document.createTextNode(element.textContent));
        }

        target.replaceChildren(template.content);
    };

    const restoreBackground = () => {
        for (const [element, inert] of background) {
            element.inert = inert;
        }
        background.clear();
    };

    const open = () => {
        window.clearTimeout(closeTimer);
        if (active) {
            input.focus();
            return;
        }
        active = true;
        lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        for (const sibling of document.body.children) {
            if (!(sibling instanceof HTMLElement) || sibling.contains(panel)) {
                continue;
            }
            background.set(sibling, sibling.inert);
            sibling.inert = true;
        }
        panel.inert = false;
        panel.hidden = false;
        // Force a frame so the transition has a starting state to move from.
        openFrame = requestAnimationFrame(() => {
            panel.classList.add("is-open");
            input.focus();
        });
        void loadPagefind();
    };

    const close = () => {
        if (!active) {
            return;
        }
        active = false;
        cancelAnimationFrame(openFrame);
        panel.inert = true;
        panel.classList.remove("is-open");
        restoreBackground();
        if (lastFocused?.isConnected) {
            lastFocused.focus();
        }
        closeTimer = window.setTimeout(() => {
            panel.hidden = true;
        }, 220);
    };

    // The old panel must release the page before Astro swaps in the next one.
    document.addEventListener(
        "astro:before-swap",
        () => {
            active = false;
            token++;
            cancelAnimationFrame(openFrame);
            window.clearTimeout(closeTimer);
            panel.inert = true;
            panel.hidden = true;
            restoreBackground();
        },
        { once: true },
    );

    openBtn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);

    panel.addEventListener("click", (event) => {
        if (event.target === panel) {
            close();
        }
    });

    /*
     * The panel is opened with "/" or ⌘K, so it has to be finishable from the
     * keyboard too: the arrows walk the hits and Enter opens the one in hand.
     * Focus is moved onto the links themselves rather than tracked in a variable,
     * which is what makes the marked row the same one a screen reader announces.
     */
    panel.addEventListener("keydown", (event) => {
        if (!active || event.isComposing) {
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }

        if (event.key === "Tab") {
            const controls = [input, closeBtn, ...hits()].filter(
                (element): element is HTMLElement => element instanceof HTMLElement,
            );
            const first = controls[0];
            const last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
            return;
        }

        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
        }

        const items = hits();
        if (items.length === 0) {
            return;
        }
        event.preventDefault();

        const here =
            document.activeElement instanceof HTMLAnchorElement
                ? items.indexOf(document.activeElement)
                : -1;
        const next = event.key === "ArrowDown" ? here + 1 : here - 1;

        if (next < 0) {
            input.focus();
        }
        else {
            items[Math.min(next, items.length - 1)]?.focus();
        }
    });

    input.addEventListener("keydown", (event) => {
        if (event.isComposing || event.key !== "Enter") {
            return;
        }
        const first = hits()[0];
        if (!first) {
            return;
        }
        event.preventDefault();
        first.click();
    });

    const search = async () => {
        const query = input.value.trim();
        const mine = ++token;

        if (!query) {
            list.replaceChildren();
            note.textContent = "";
            note.hidden = true;
            return;
        }

        list.replaceChildren();
        note.textContent = loadingText;
        note.hidden = false;

        try {
            const engine = await loadPagefind();
            if (mine !== token) {
                return;
            }
            if (!engine) {
                throw new Error("Search index unavailable");
            }

            const results = readPagefindReferences(await engine.search(query));
            if (mine !== token) {
                return;
            }

            const top = await Promise.all(
                results
                    .slice(0, 8)
                    .map(async (reference) => readPagefindResult(await reference.data())),
            );
            if (mine !== token) {
                return;
            }

            list.replaceChildren(
                ...top.map((hit) => {
                    const li = document.createElement("li");
                    li.className = "search-result";

                    const a = document.createElement("a");
                    a.href = hit.url;

                    const title = document.createElement("div");
                    title.className = "search-result-title";
                    title.textContent = hit.meta?.title ?? hit.url;

                    const excerpt = document.createElement("p");
                    excerpt.className = "search-result-excerpt";
                    // Pagefind's excerpt contains <mark> and is built from indexed text.
                    setExcerpt(excerpt, hit.excerpt ?? "");

                    a.append(title, excerpt);
                    li.append(a);
                    return li;
                }),
            );

            note.hidden = top.length > 0;
            note.textContent = top.length ? "" : emptyText;
        } catch {
            if (mine !== token) {
                return;
            }
            list.replaceChildren();
            note.textContent = unavailableText;
            note.hidden = false;
        }
    };

    input.addEventListener("input", () => {
        void search();
    });

    // Keyboard shortcut, registered once.
    if (!globalsWired) {
        document.addEventListener("keydown", (event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            const typing =
                target?.tagName === "INPUT" ||
                target?.tagName === "TEXTAREA" ||
                target?.isContentEditable;

            const shortcut =
                (event.key === "/" && !event.metaKey && !event.ctrlKey) ||
                (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey));
            if (shortcut && !event.altKey && !event.isComposing && !typing) {
                event.preventDefault();
                document.getElementById("search-open")?.click();
            }
        });
    }
}

/* — nav menu ——————————————————————————————————— */

/*
 * Document-level handlers look their targets up on each event rather than
 * closing over them. A view transition replaces the whole DOM, so a captured
 * element would be the previous page's.
 */
function menuParts() {
    return {
        button: document.getElementById("menu-toggle"),
        menu: document.getElementById("nav-menu"),
    };
}

function setMenuOpen(open: boolean) {
    const { button, menu } = menuParts();
    if (!button || !menu) {
        return;
    }
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
}

function wireMenu() {
    const { button, menu } = menuParts();
    if (!button || !menu) {
        return;
    }

    // `hidden` is typed `string | boolean` because of `hidden="until-found"`.
    button.addEventListener("click", () => {
        setMenuOpen(menu.hidden !== false);
    });
}

/* — per-page wiring ——————————————————————————— */

function preparePlaygrounds() {
    const targets = document.querySelectorAll("[data-code-playground], [data-python-notebook]");
    if (!targets.length) {
        return;
    }
    let started = false;
    let disposed = false;
    const cleanup = () => {
        disposed = true;
        observer.disconnect();
        for (const target of targets) {
            target.removeEventListener("focusin", activate);
        }
        document.removeEventListener("astro:before-swap", cleanup);
    };

    const activate = () => {
        if (started || disposed) {
            return;
        }
        started = true;
        observer.disconnect();
        void import("./playgrounds").then(({ mountPlaygrounds }) => {
            if (!disposed) {
                mountPlaygrounds();
            }
        });
    };
    const observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                activate();
            }
        },
        { rootMargin: "300px" },
    );
    for (const target of targets) {
        observer.observe(target);
        target.addEventListener("focusin", activate);
    }
    document.addEventListener("astro:before-swap", cleanup);
}

async function init() {
    document.documentElement.classList.remove("no-js");

    navbar = document.getElementById("navbar-wrapper");
    backToTop = document.getElementById("back-to-top");

    document.getElementById("theme-toggle")?.addEventListener("click", cycleTheme);

    backToTop?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    wireSearch();
    wireMenu();
    onScroll();
    preparePlaygrounds();

    if (document.querySelector("#contents")) {
        const { mountContents } = await import("./contents");
        mountContents();
    }

    if (document.querySelector("#secret-form")) {
        const { mountSecret } = await import("./secret");
        mountSecret();
    }

    if (document.querySelector("#comments")) {
        const { mountComments } = await import("./comments");
        mountComments();
    }

    if (document.querySelector(".diagram[data-mermaid]")) {
        const { renderDiagrams } = await import("./diagrams");
        await renderDiagrams();
    }

    if (document.querySelector(".figure[data-figure]")) {
        const { mountFigures } = await import("./figures");
        await mountFigures();
    }

    if (!globalsWired) {
        globalsWired = true;
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("dragstart", (event) => {
            if (
                event.target instanceof Element &&
                event.target.closest("#sidebar, #navbar-wrapper")
            )
            {
                event.preventDefault();
            }
        });

        document.addEventListener("click", (event) => {
            const { button, menu } = menuParts();
            const target = event.target instanceof Node ? event.target : null;
            if (!menu || menu.hidden || !target) {
                return;
            }
            if (menu.contains(target) || button?.contains(target)) {
                return;
            }
            setMenuOpen(false);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }
            const { button, menu } = menuParts();
            if (menu && !menu.hidden) {
                setMenuOpen(false);
                button?.focus();
            }
        });

        /*
         * fuwari's trick: the staggered entrance is an arrival flourish, so it is
         * spent once. From the first in-site navigation onward the content lands
         * immediately and only the page transition plays.
         *
         * This runs after the swap because the swap resets inline styles on
         * <html> along with everything else the new document brings.
         */
        document.addEventListener("astro:after-swap", () => {
            document.documentElement.dataset.navigated = "true";
            const root = document.documentElement.style;
            root.setProperty("--content-delay", "0ms");
            root.setProperty("--onload-dur", "0ms");
        });
    }
}

document.addEventListener("astro:page-load", () => {
    void init();
});
