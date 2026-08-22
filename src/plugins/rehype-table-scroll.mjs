import { visit } from "unist-util-visit";

/**
 * Wraps tables so a wide one scrolls inside its own box instead of widening the
 * page. Done at build time rather than in a client script, because a table that
 * only becomes readable once JavaScript arrives is not readable.
 */
export function rehypeTableScroll() {
	/** @type {import("unified").Transformer<import("hast").Root>} */
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "table" || !parent || index === undefined) return;
			if (parent.type === "element" && parent.properties?.className?.includes?.("table-scroll")) {
				return;
			}

			parent.children[index] = {
				type: "element",
				tagName: "div",
				properties: { className: ["table-scroll"], tabIndex: 0, role: "region" },
				children: [node],
			};
		});
	};
}
