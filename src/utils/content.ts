import { type CollectionEntry, getCollection, render } from "astro:content";
import { type CategoryKey, categories } from "../config";
import { sitePath } from "./url";

export type Post = CollectionEntry<"posts">;

/** Values the remark plugins inject into frontmatter while rendering. */
export interface PostMeta {
	readingTime?: number;
	excerpt?: string;
}

/** Narrows metadata produced by remark plugins instead of trusting a cast. */
export function parsePostMeta(value: object | null | undefined): PostMeta {
	if (!value || Array.isArray(value)) return {};

	const readingTime = "readingTime" in value ? value.readingTime : undefined;
	const excerpt = "excerpt" in value ? value.excerpt : undefined;

	return {
		...(typeof readingTime === "number" &&
		Number.isFinite(readingTime) &&
		readingTime >= 1
			? { readingTime }
			: {}),
		...(typeof excerpt === "string" ? { excerpt } : {}),
	};
}

/**
 * The injected frontmatter for an entry — its reading time and its excerpt.
 *
 * Astro types `rendered.metadata.frontmatter` as an empty object, since it
 * cannot know what a project's remark plugins add, so it is narrowed here
 * rather than cast at every call site.
 *
 * `.mdx` entries are not rendered into the content store during sync, so for
 * those the store holds nothing and the file has to be rendered on the spot.
 * Without this an MDX post silently loses its reading time on every listing
 * while looking perfectly fine on its own page.
 */
export async function postMeta(entry: Post): Promise<PostMeta> {
	const rawStored = entry.rendered?.metadata?.frontmatter;
	const stored = parsePostMeta(
		typeof rawStored === "object" ? rawStored : undefined,
	);
	if (Object.keys(stored).length > 0) return stored;

	const { remarkPluginFrontmatter } = await render(entry);
	return parsePostMeta(remarkPluginFrontmatter);
}

export interface PostRef {
	entry: Post;
	/**
	 * Path below `src/content/posts`, without the extension.
	 * Directory segments are preserved, e.g. `databases/postgres/indexing`.
	 */
	path: string;
	/** Site-absolute URL. */
	href: string;
	/** What a comment thread is filed under. */
	key: string;
}

const isPublished = (entry: Post) =>
	import.meta.env.DEV || !entry.data.draft;

function toRef(entry: Post): PostRef {
	return {
		entry,
		path: entry.id,
		href: sitePath(`/posts/${entry.id}`),
		key: entry.id,
	};
}

const byNewest = (a: PostRef, b: PostRef) =>
	b.entry.data.published.valueOf() - a.entry.data.published.valueOf();

/** Every published post, newest first. */
export async function getPosts(): Promise<PostRef[]> {
	const entries = await getCollection("posts", isPublished);
	return entries.map(toRef).sort(byNewest);
}

/**
 * Neighbours in publication order.
 *
 * `prev` is the older post, `next` the newer one — reading order, not array
 * order, which is why the indices look inverted against a newest-first list.
 */
export async function getNeighbours(ref: PostRef) {
	const posts = await getPosts();
	const i = posts.findIndex((p) => p.entry.id === ref.entry.id);
	if (i === -1) return { prev: undefined, next: undefined };
	return { prev: posts[i + 1], next: posts[i - 1] };
}

export interface TagCount {
	tag: string;
	count: number;
}

/** Tags, most used first, ties broken alphabetically. */
export async function getTags(): Promise<TagCount[]> {
	const posts = await getPosts();
	const counts = new Map<string, number>();

	for (const { entry } of posts) {
		for (const tag of entry.data.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function getPostsByTag(tag: string) {
	const posts = await getPosts();
	return posts.filter(({ entry }) => entry.data.tags.includes(tag));
}

export interface CategoryCount {
	key: CategoryKey;
	/** What it is called — the key never reaches a reader. */
	name: string;
	count: number;
}

/**
 * What a category is called.
 *
 * The lookup cannot miss according to the types, and misses anyway when the
 * content store is warmer than `src/config.ts` — delete a category that posts
 * are still filed under and the schema will not re-run, so the stale key
 * arrives here. Saying so beats the `undefined` this would otherwise read a
 * name off, which surfaces a long way from the file that caused it.
 */
export function categoryName(key: CategoryKey): string {
	const lookup: Readonly<Partial<Record<string, string>>> = categories;
	const name = lookup[key];

	if (!name) {
		throw new Error(
			`No category "${key}". A post is filed under it, but src/config.ts ` +
				`defines only: ${Object.keys(categories).join(", ")}. Add it back, ` +
				"or refile the post — and run `npm run build:clean`, because a warm " +
				"content store is why the schema did not catch this first.",
		);
	}

	return name;
}

/**
 * The categories that have something in them, in declaration order.
 *
 * Empty ones are dropped, so a category nothing has been written in yet is
 * simply absent rather than a row promising posts that are not there. It is
 * also why the routes are built from this: an empty category never gets a page
 * to land on.
 */
export async function getCategories(): Promise<CategoryCount[]> {
	const posts = await getPosts();
	const counts = new Map<CategoryKey, number>();

	for (const { entry } of posts) {
		const key = entry.data.category;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return (Object.keys(categories) as CategoryKey[])
		.map((key) => ({ key, name: categoryName(key), count: counts.get(key) ?? 0 }))
		.filter(({ count }) => count > 0);
}

export async function getPostsByCategory(key: CategoryKey) {
	const posts = await getPosts();
	return posts.filter(({ entry }) => entry.data.category === key);
}

export interface YearGroup {
	year: number;
	posts: PostRef[];
}

/** Posts bucketed by publication year, newest year first. */
export async function groupByYear(): Promise<YearGroup[]> {
	const posts = await getPosts();
	const years = new Map<number, PostRef[]>();

	for (const ref of posts) {
		const year = ref.entry.data.published.getUTCFullYear();
		const bucket = years.get(year);
		if (bucket) bucket.push(ref);
		else years.set(year, [ref]);
	}

	return [...years.entries()]
		.map(([year, entries]) => ({ year, posts: entries }))
		.sort((a, b) => b.year - a.year);
}

export type Comment = CollectionEntry<"comments">;

/** Approved comments on a post, oldest first — a conversation reads forward. */
/*
 * Read once per build rather than once per post. Besides the obvious, it keeps
 * an empty store from warning on every page it is asked about.
 */
let commentCache: Comment[] | null = null;

export async function getComments(postKey: string): Promise<Comment[]> {
	commentCache ??= await getCollection("comments");

	return commentCache
		.filter(
			(entry) => entry.data.approved && entry.data.post === postKey,
		)
		.sort((a, b) => a.data.published.valueOf() - b.data.published.valueOf());
}

/** URL-safe tag segment. A Korean tag survives this via encodeURIComponent. */
export const tagSlug = (tag: string) => encodeURIComponent(tag);
