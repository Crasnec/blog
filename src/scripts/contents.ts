/**
 * Marks the section you are in on the contents rail.
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

export function mountContents() {
	teardown();

	const root = document.getElementById("contents");
	const scrollEl = root?.querySelector<HTMLElement>(".contents-scroll");
	if (!root || !scrollEl) return;

	const scroller = scrollEl;
	const items = [...root.querySelectorAll<HTMLAnchorElement>(".contents-item")];
	if (items.length === 0) return;

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

	function paint() {
		const next = crossing.size > 0 ? Math.max(...crossing) : nearest();
		if (next === marked) return;

		if (marked !== -1) items[marked]?.classList.remove("is-active");
		marked = next;
		if (marked === -1) return;

		const item = items[marked];
		if (!item) return;
		item.classList.add("is-active");
		keepVisible(item);
	}

	/** Scrolls the rail so the marked item stays in view, never the page. */
	function keepVisible(item: HTMLElement) {
		const box = scroller.getBoundingClientRect();
		const { top, bottom } = item.getBoundingClientRect();
		if (top >= box.top && bottom <= box.bottom) return;

		scroller.scrollTo({
			top: scroller.scrollTop + (top - box.top) - box.height / 3,
			behavior: "smooth",
		});
	}

	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				const i = indexOfSection.get(entry.target);
				if (i === undefined) continue;
				if (entry.isIntersecting) crossing.add(i);
				else crossing.delete(i);
			}
			requestAnimationFrame(paint);
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
}

document.addEventListener("astro:before-swap", teardown);
