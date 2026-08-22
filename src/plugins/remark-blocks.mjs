import { visit } from "unist-util-visit";

/**
 * Container directives for admonitions.
 *
 *   :::note[선택 제목]
 *   본문
 *   :::
 *
 *   :::warning
 *   ...
 *   :::
 *
 * Five kinds, no numbering, no counters. A callout interrupts the reader, so
 * there is a cost to every one of them; the set is deliberately small enough
 * that each still means something when it appears.
 *
 * Output is expressed with `data.hName`/`hProperties` so that .md and .mdx
 * render identically — raw HTML nodes do not survive the MDX pipeline.
 */

const ADMONITIONS = {
	note: "Note",
	tip: "Tip",
	important: "Important",
	warning: "Warning",
	caution: "Caution",
};

/**
 * An emphasis node whose only job is to become an inline element in hast.
 * @param {string} className
 * @param {import("mdast").PhrasingContent[]} children
 * @returns {import("mdast").Emphasis}
 */
function span(className, children) {
	return {
		type: "emphasis",
		data: { hName: "span", hProperties: { className: [className] } },
		children,
	};
}

export function remarkBlocks() {
	/** @type {import("unified").Transformer<import("mdast").Root>} */
	return (tree) => {
		visit(tree, "containerDirective", (node) => {
			const kind = node.name;
			if (!(kind in ADMONITIONS)) return;
			const key = /** @type {keyof typeof ADMONITIONS} */ (kind);
			const admonition = ADMONITIONS[key];

			const attrs = node.attributes ?? {};
			const children = node.children ?? [];

			// remark-directive parks `[label]` in a first child flagged as the label.
			/** @type {import("mdast").PhrasingContent[] | null} */
			let title = null;
			const first = children[0];
			if (
				first?.type === "paragraph" &&
				first.data &&
				"directiveLabel" in first.data
			) {
				title = first.children;
				node.children = children.slice(1);
			}

			/** @type {import("mdast").Paragraph} */
			const head = {
				type: "paragraph",
				data: { hName: "div", hProperties: { className: ["block-head"] } },
				children: [
					span("block-kind", [{ type: "text", value: admonition }]),
					...(title ? [span("block-title", title)] : []),
				],
			};

			node.children = [head, ...node.children];

			node.data = {
				...(node.data ?? {}),
				hName: "aside",
				hProperties: {
					className: ["block", `block-${kind}`],
					"data-kind": kind,
					...(attrs.id ? { id: attrs.id } : {}),
				},
			};
		});
	};
}
