/**
 * Marks the current section in the rail and mobile outline.
 *
 * Sections come from remark-sectionize, which nests a <section> around each
 * heading and its content — that is what makes "which heading am I under"
 * answerable as "whose section crosses this line".
 *
 * The line is a band a quarter of the way down the viewport rather than the
 * viewport edge, because a heading is not what you are reading until it has
 * scrolled up to where your eyes are. Exactly one item is ever marked: h3
 * sections nest inside their h2, so both cross the band at once and the deepest
 * one wins, which is the more specific answer to "where am I".
 */

/** Where the reading line sits: 30% down, as a thin band. */
const BAND = { top: "-30%", bottom: "-68%" };

let observer: IntersectionObserver | null = null;
let listeners: AbortController | null = null;
let paintFrame = 0;

export function mountContents() {
    teardown();

    const root = document.getElementById("contents");
    if (!root) return;

    const items = [...root.querySelectorAll<HTMLAnchorElement>(".contents-item")];
    if (items.length === 0) return;

    listeners = new AbortController();
    const links = [
        ...items,
        ...document.querySelectorAll<HTMLAnchorElement>(".contents-inline-list a[data-slug]"),
    ];
    const linksBySlug = new Map<string, HTMLAnchorElement[]>();
    for (const link of links) {
        const slug = link.dataset.slug;
        if (!slug) continue;
        const matches = linksBySlug.get(slug) ?? [];
        matches.push(link);
        linksBySlug.set(slug, matches);
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
        link.addEventListener(
            "click",
            (event) => {
                if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                )
                    return;
                const heading = document.getElementById(slug);
                if (!heading) return;

                // Collapse before the browser follows the fragment, so its scroll
                // position accounts for the space the open outline used to occupy.
                const details = link.closest("details");
                if (details) details.open = false;
                heading.tabIndex = -1;
                heading.focus({ preventScroll: true });
            },
            { signal: listeners.signal },
        );
    }

    const sections: (HTMLElement | undefined)[] = [];
    const indexOfSection = new Map<Element, number>();
    const crossing = new Set<number>();

    items.forEach((item, i) => {
        const slug = item.dataset.slug;
        if (!slug) return;
        const heading = document.getElementById(slug);
        const section = heading?.closest("section") ?? heading?.parentElement;
        if (!section) return;
        sections[i] = section;
        indexOfSection.set(section, i);
    });

    /**
     * The last section that has started above the band, for the moments the band
     * itself is empty — between two sections, or past the end of the article.
     */
    function nearest(): number {
        let found = -1;
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (!section) continue;
            if (section.getBoundingClientRect().top <= window.innerHeight * 0.3) {
                found = i;
            }
        }
        return found;
    }

    let marked = -1;

    function mark(index: number, active: boolean) {
        const slug = items[index]?.dataset.slug;
        if (!slug) return;
        for (const link of linksBySlug.get(slug) ?? []) {
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        }
    }

    function paint() {
        paintFrame = 0;
        const next = crossing.size > 0 ? Math.max(...crossing) : nearest();
        if (next === marked) return;

        if (marked !== -1) mark(marked, false);
        marked = next;
        if (marked !== -1) mark(marked, true);
    }

    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const i = indexOfSection.get(entry.target);
                if (i === undefined) continue;
                if (entry.isIntersecting) crossing.add(i);
                else crossing.delete(i);
            }
            if (!paintFrame) paintFrame = requestAnimationFrame(paint);
        },
        { rootMargin: `${BAND.top} 0px ${BAND.bottom} 0px`, threshold: 0 },
    );

    for (const section of sections) {
        if (section) observer.observe(section);
    }

    paint();
}

function teardown() {
    observer?.disconnect();
    observer = null;
    listeners?.abort();
    listeners = null;
    cancelAnimationFrame(paintFrame);
    paintFrame = 0;
}

document.addEventListener("astro:before-swap", teardown);
