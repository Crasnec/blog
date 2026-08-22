import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Root as HastRoot } from "hast";
import type { Paragraph, Root as MdastRoot, Strong, Text } from "mdast";
import { siteConfig } from "../config.ts";

/**
 * Compiles one comment body from Markdown to HTML.
 *
 * A comment is Markdown written by a stranger, which is a different problem
 * from a post written by the author: the pipeline is built to say no. Raw HTML
 * never survives parsing, the result is sanitised against an allow-list, and
 * only then are this site's own attributes added — so nothing a commenter
 * writes can reach the page as markup.
 *
 * The subset is deliberately smaller than the one posts get:
 *
 *   headings   demoted to bold text — a comment must not join the page outline
 *   images     dropped — remote images leak the reader's IP and hotlink
 *   footnotes  dropped — their ids would collide between comments
 *   code       no highlighting; Expressive Code is for files, not for strings
 *
 * Links keep working but are labelled: anything leaving the site is marked so
 * the reader is asked before following it.
 */

/** Host that counts as "this site". Everything else is somewhere else. */
const SITE_HOST = (() => {
	try {
		return new URL(siteConfig.url).host;
	} catch {
		return "";
	}
})();

/** Markdown that has no business in a comment, removed before it becomes HTML. */
function remarkCommentSubset() {
	return (tree: MdastRoot) => {
		visit(tree, (node, index, parent) => {
			if (!parent || index === undefined) return undefined;

			// A heading in a comment claims a place in the document's outline that
			// it has not earned. The emphasis was the point, so keep that.
			if (node.type === "heading") {
				const strong: Strong = { type: "strong", children: node.children };
				const paragraph: Paragraph = {
					type: "paragraph",
					children: [strong],
				};
				parent.children[index] = paragraph;
				return undefined;
			}

			/*
			 * Raw HTML becomes visible text rather than being dropped. Dropping it
			 * is safe but lossy: Markdown hands a whole block to the HTML node, so
			 * "<div> 이렇게 씁니다" would lose the sentence along with the tag. On a
			 * blog about code, people type tags into comments on purpose.
			 */
			if (node.type === "html") {
				const text: Text = { type: "text", value: node.value };
				parent.children[index] = text;
				return undefined;
			}

			if (
				node.type === "image" ||
				node.type === "imageReference" ||
				node.type === "footnoteReference" ||
				node.type === "footnoteDefinition"
			) {
				parent.children.splice(index, 1);
				return index;
			}

			return undefined;
		});

		// Removing an image can leave the paragraph that held it standing empty.
		visit(tree, "paragraph", (node, index, parent) => {
			if (!parent || index === undefined) return undefined;
			if (node.children.length > 0) return undefined;
			parent.children.splice(index, 1);
			return index;
		});

		// An escaped HTML block lands at the root as bare text, which would sit
		// outside the block rhythm. Give it the paragraph it would have had.
		tree.children = tree.children.map((child) => {
			if (child.type !== "text") return child;
			const paragraph: Paragraph = { type: "paragraph", children: [child] };
			return paragraph;
		});
	};
}

/**
 * The allow-list. Anything not named here is dropped, so the failure mode of
 * forgetting something is a missing tag rather than an open door.
 */
const schema = {
	...defaultSchema,
	tagNames: [
		"p",
		"br",
		"strong",
		"em",
		"del",
		"code",
		"pre",
		"a",
		"ul",
		"ol",
		"li",
		"blockquote",
		"hr",
		"table",
		"thead",
		"tbody",
		"tr",
		"th",
		"td",
	],
	attributes: {
		a: ["href", "title"],
		th: ["align"],
		td: ["align"],
	},
	protocols: { href: ["http", "https", "mailto"] },
	// Any id that does survive is namespaced, so a comment cannot capture a
	// fragment link belonging to the article.
	clobberPrefix: "comment-",
};

/** Marks links that leave the site, after sanitising so the marks survive. */
function rehypeMarkExternal() {
	return (tree: HastRoot) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "a") return undefined;

			const href = node.properties.href ?? "";

			/*
			 * The sanitiser strips a `javascript:` href but leaves the anchor, which
			 * then looks like a link and does nothing. Better to be plain text.
			 */
			if (!href) {
				if (parent && index !== undefined) {
					parent.children.splice(index, 1, ...node.children);
					return index;
				}
				return undefined;
			}

			let url: URL;
			try {
				url = new URL(href, `https://${SITE_HOST || "localhost"}`);
			} catch {
				return undefined;
			}

			const leaving =
				(url.protocol === "http:" || url.protocol === "https:") &&
				url.host !== SITE_HOST;
			if (!leaving) return undefined;

			node.properties = {
				...node.properties,
				// `ugc` says a stranger wrote it; `noreferrer` keeps the reader's
				// current page out of the destination's logs.
				rel: ["nofollow", "ugc", "noopener", "noreferrer"],
				"data-external": "true",
				"data-host": url.host,
			};
			return undefined;
		});
	};
}

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkCommentSubset)
	.use(remarkRehype)
	.use(rehypeSanitize, schema)
	.use(rehypeMarkExternal)
	.use(rehypeStringify);

/**
 * Compiled HTML for a comment body.
 *
 * Synchronous and cheap — about 0.7ms each — so it runs per comment at build
 * time with no cache. If that ever stops being cheap, key a cache on a hash of
 * the body: nothing about the stored shape has to change for that.
 */
export function renderCommentBody(markdown: string): string {
	return String(processor.processSync(markdown));
}
