import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { CATEGORY_KEYS } from "./config";

/** Posts are one flat directory: `src/content/posts/<slug>.md`. */
const posts = defineCollection({
	loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.coerce.date(),
		updated: z.coerce.date().optional(),

		/** Overrides the generated excerpt on index entries and in meta tags. */
		description: z.string().optional(),

		/**
		 * The one area this post belongs to, by key. Required and closed: the set
		 * lives in `src/config.ts`, so a post filed under something that is not
		 * there fails the build naming the ones that are, rather than quietly
		 * creating a category of one that nothing links to.
		 */
		category: z.enum(CATEGORY_KEYS),

		/** Free, and as many as apply. What the post is about, not where it sits. */
		tags: z.array(z.string()).default([]),

		/** Excluded from every listing and from the build in production. */
		draft: z.boolean().default(false),

		/**
		 * A locked post's body, encrypted by its author before it was committed.
		 *
		 * There is no passphrase here and no plaintext anywhere in this
		 * repository — `npm run secret:seal` produces this field and the build
		 * only ever passes it through, so publishing the repository gives away
		 * nothing the published site does not already give away.
		 *
		 * Present means locked. The title, date, tags and category beside it stay
		 * visible on every listing; only the body is a secret.
		 */
		sealed: z
			.object({
				/** Scheme version. A mismatch fails in the browser rather than half-working. */
				v: z.number().int().positive(),
				/** The seal's own public key. Fresh per seal, and in the clear. */
				epk: z.string(),
				iv: z.string(),
				data: z.string(),
				/** The theme whose colours are baked into the sealed code blocks. */
				theme: z.string(),
			})
			.optional(),

	}),
});

/**
 * Comments, cloned into `.comments/` from their own repository by
 * `scripts/pull-comments.mjs` before every build. Nothing here is written by
 * hand and nothing here is committed to this repository.
 */
const comments = defineCollection({
	loader: glob({ pattern: "**/*.json", base: "./.comments" }),
	schema: z.object({
		/** The slug of the post it belongs to. */
		post: z.string(),
		author: z.string(),
		body: z.string(),
		published: z.coerce.date(),

		/** Which locale it was written from. Kept for context, not for filtering. */
		lang: z.string().optional(),

		/**
		 * Written `false` by the workflow and flipped by hand in the comment
		 * repository. Nothing unapproved is ever rendered, so spam that gets past
		 * the workflow still never reaches a reader.
		 */
		approved: z.boolean().default(false),
	}),
});

const pages = defineCollection({
	loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
	}),
});

export const collections = { posts, pages, comments };
