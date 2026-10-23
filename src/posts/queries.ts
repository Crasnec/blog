import { type CollectionEntry, getCollection, render } from "astro:content";
import { POSTS_DIRECTORY } from "#src/post-source.ts";
import {
    categoryContains,
    categoryFromFile,
    countCategories,
    type Category,
    type CategoryCount,
} from "#src/posts/category.ts";
import { sitePath } from "#src/utils/url.ts";
import { HTML_LANG } from "#src/strings.ts";
import {
    comparePostOrder,
    groupSeries,
    postNeighbours,
    seriesNeighbours,
    type PostSeries,
} from "#src/posts/series.ts";

export type Post = CollectionEntry<"posts">;

/** Values the remark plugins inject into frontmatter while rendering. */
export interface PostMeta {
    readingTime?: number;
    excerpt?: string;
}

/** Narrows metadata produced by remark plugins instead of trusting a cast. */
export function parsePostMeta(value: object | null | undefined): PostMeta {
    if (!value || Array.isArray(value)) {
        return {};
    }

    const readingTime = "readingTime" in value ? value.readingTime : undefined;
    const excerpt = "excerpt" in value ? value.excerpt : undefined;

    return {
        ...(typeof readingTime === "number" && Number.isFinite(readingTime) && readingTime >= 1
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
    const stored = parsePostMeta(typeof rawStored === "object" ? rawStored : undefined);
    if (Object.keys(stored).length > 0) {
        return stored;
    }

    const { remarkPluginFrontmatter } = await render(entry);
    return parsePostMeta(remarkPluginFrontmatter);
}

export interface PostRef {
    entry: Post;
    category: Category;
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

const isPublished = (entry: Post) => import.meta.env.DEV || !entry.data.draft;

function toRef(entry: Post): PostRef {
    if (!entry.filePath) {
        throw new Error(`Post "${entry.id}" has no source path for its category.`);
    }
    return {
        entry,
        category: categoryFromFile(entry.filePath, POSTS_DIRECTORY),
        path: entry.id,
        href: sitePath(`/posts/${entry.id}`),
        key: entry.id,
    };
}

/** Every visible post, with authored positions before the newest unnumbered posts. */
export async function getPosts(): Promise<PostRef[]> {
    const entries = await getCollection("posts", isPublished);
    const posts = entries.map(toRef).sort(comparePostOrder);
    countCategories(posts.map(({ category }) => category));
    groupSeries(posts);
    return posts;
}

/** A series owns its reading order; standalone posts use the global list. */
export async function getNeighbours(ref: PostRef) {
    const posts = await getPosts();
    const series = groupSeries(posts).find((group) => group.name === ref.entry.data.series?.name);
    return series ? seriesNeighbours(series, ref.entry.id) : postNeighbours(posts, ref.entry.id);
}

export async function getSeries(): Promise<PostSeries<PostRef>[]> {
    return groupSeries(await getPosts());
}

export async function getPostSeries(ref: PostRef): Promise<PostSeries<PostRef> | undefined> {
    const name = ref.entry.data.series?.name;
    return name ? (await getSeries()).find((series) => series.name === name) : undefined;
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
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, HTML_LANG));
}

export async function getPostsByTag(tag: string) {
    const posts = await getPosts();
    return posts.filter(({ entry }) => entry.data.tags.includes(tag));
}

/** Category tree, with descendant counts and untranslated names at every level. */
export async function getCategories(): Promise<CategoryCount[]> {
    const posts = await getPosts();
    return countCategories(posts.map(({ category }) => category));
}

export async function getPostsByCategory(key: string) {
    const posts = await getPosts();
    return posts.filter(({ category }) => categoryContains(key, category.key));
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
        if (bucket) {
            bucket.push(ref);
        } else {
            years.set(year, [ref]);
        }
    }

    return [...years.entries()]
        .map(([year, entries]) => ({ year, posts: entries }))
        .sort((a, b) => b.year - a.year);
}

/** URL-safe tag segment. A Korean tag survives this via encodeURIComponent. */
export const tagSlug = (tag: string) => encodeURIComponent(tag);
