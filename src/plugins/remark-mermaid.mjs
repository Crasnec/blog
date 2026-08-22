import { visit } from "unist-util-visit";

/**
 * Turn ```mermaid fences into a `<figure data-mermaid="…">` that the client
 * script renders.
 *
 * The node is rewritten with `data.hName`/`hProperties` rather than replaced by
 * a raw `html` node, because raw HTML does not survive the MDX pipeline. Going
 * through mdast → hast means .md and .mdx behave identically.
 *
 * The fence source is kept inside the figure as a <pre>, so a reader without
 * JavaScript still gets the diagram definition instead of an empty box.
 */
export function remarkMermaid() {
	/** @type {import("unified").Transformer<import("mdast").Root>} */
	return (tree) => {
		visit(tree, "code", (node, index, parent) => {
			if (node.lang !== "mermaid" || index === undefined || !parent) return;

			const source = node.value ?? "";
			const caption = (node.meta ?? "").trim();

			/** @type {import("hast").ElementContent[]} */
			const hChildren = [
				{
					type: "element",
					tagName: "pre",
					properties: { className: ["diagram-source"] },
					children: [{ type: "text", value: source }],
				},
				...(caption
					? [
							{
								type: /** @type {const} */ ("element"),
								tagName: "figcaption",
								properties: {},
								children: [{ type: /** @type {const} */ ("text"), value: caption }],
							},
						]
					: []),
			];

			/** @type {import("mdast").Paragraph} */
			const paragraph = {
				type: "paragraph",
				children: [],
				data: {
					hName: "figure",
					hProperties: {
						className: ["diagram", "is-pending"],
						"data-mermaid": source,
						// The fallback <pre> holds diagram syntax, not prose. Indexing it
						// would put "flowchart TD A-->B" into search excerpts.
						"data-pagefind-ignore": "all",
						...(caption ? { "data-caption": caption } : {}),
					},
					hChildren,
				},
			};

			parent.children[index] = paragraph;
		});
	};
}
