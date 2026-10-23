import { t } from "#src/strings.ts";
import { loadPagefind, readPagefindReferences, readPagefindResult } from "#src/site/search/engine.ts";

let shortcutWired = false;

export function mountSearch() {
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
        } else {
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
    if (!shortcutWired) {
        shortcutWired = true;
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
