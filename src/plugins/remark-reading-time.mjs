import { toString } from "mdast-util-to-string";

/** Latin words per minute. */
const WPM = 210;
/** Hangul/CJK characters per minute. */
const CPM = 520;

const CJK = /[ㄱ-ㆎ가-힣぀-ヿ一-鿿]/gu;

/**
 * Reading time that does not lie about Korean.
 *
 * Word-splitting on whitespace undercounts Hangul badly — a 40-character
 * Korean sentence is often two "words". So CJK characters are counted and
 * costed separately, and the two budgets are added.
 */
export function remarkReadingTime() {
	/** @type {import("unified").Transformer<import("mdast").Root>} */
	return (tree, { data }) => {
		const text = toString(tree);

		const cjkChars = (text.match(CJK) ?? []).length;
		const latin = text.replace(CJK, " ");
		const latinWords = latin.split(/\s+/u).filter(Boolean).length;

		const minutes = Math.max(1, Math.round(latinWords / WPM + cjkChars / CPM));

		data.astro ??= {};
		data.astro.frontmatter ??= {};
		data.astro.frontmatter.readingTime = minutes;
	};
}
