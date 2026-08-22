import { toString } from "mdast-util-to-string";

const MAX = 180;

/**
 * First real paragraph of the post, for index entries that omit `description`.
 *
 * Skips directives, code and math so the excerpt never opens with half a
 * formula.
 */
export function remarkExcerpt() {
	/** @type {import("unified").Transformer<import("mdast").Root>} */
	return (tree, { data }) => {
		const skip = new Set([
			"code",
			"math",
			"containerDirective",
			"leafDirective",
			"html",
			"thematicBreak",
		]);

		let excerpt = "";
		for (const node of tree.children) {
			if (node.type !== "paragraph" || skip.has(node.type)) continue;
			const text = toString(node).trim();
			if (!text) continue;
			excerpt = text;
			break;
		}

		if (excerpt.length > MAX) {
			excerpt = `${excerpt.slice(0, MAX).trimEnd()}…`;
		}

		data.astro ??= {};
		data.astro.frontmatter ??= {};
		data.astro.frontmatter.excerpt = excerpt;
	};
}
