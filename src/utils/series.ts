import { slug } from "github-slugger";
import type { SeriesMetadata } from "./post-order.ts";

export interface SeriesSource {
    entry: {
        id: string;
        data: { series?: SeriesMetadata | undefined };
    };
}

export interface SeriesPart<T> {
    post: T;
    order: number;
}

export interface PostSeries<T> {
    key: string;
    name: string;
    parts: SeriesPart<T>[];
}

/** Human-readable Unicode URLs; names themselves remain exactly as authored. */
export function seriesSlug(name: string): string {
    const key = slug(name.trim().normalize("NFC"));
    if (!key) {
        throw new Error(`Series "${name}" must produce a nonempty URL slug.`);
    }
    return key;
}

export const seriesPath = (name: string): string =>
    `/series/${encodeURIComponent(seriesSlug(name))}/`;

/** Validate the visible collection before making routes or choosing neighbours. */
export function groupSeries<T extends SeriesSource>(posts: Iterable<T>): PostSeries<T>[] {
    const groups = new Map<string, PostSeries<T>>();
    for (const post of posts) {
        const metadata = post.entry.data.series;
        if (!metadata) {
            continue;
        }
        const name = metadata.name.trim();
        const key = seriesSlug(name);
        const { order } = metadata;
        if (!Number.isSafeInteger(order) || order < 1) {
            throw new Error(
                `Series "${name}" needs a positive integer order for "${post.entry.id}".`,
            );
        }
        let series = groups.get(key);
        if (series && series.name !== name) {
            throw new Error(
                `Series "${series.name}" and "${name}" share the URL "${key}". Rename one series.`,
            );
        }
        if (!series) {
            series = { key, name, parts: [] };
            groups.set(key, series);
        }
        const duplicate = series.parts.find((part) => part.order === order);
        if (duplicate) {
            throw new Error(
                `Series "${name}" uses order ${String(order)} for both "${duplicate.post.entry.id}" and "${post.entry.id}". Choose a distinct order.`,
            );
        }
        series.parts.push({ post, order });
    }
    for (const series of groups.values()) {
        series.parts.sort((a, b) => a.order - b.order);
    }
    return [...groups.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Series navigation follows the author's order even when publication dates differ. */
export function seriesNeighbours<T extends SeriesSource>(series: PostSeries<T>, id: string) {
    const index = series.parts.findIndex(({ post }) => post.entry.id === id);
    if (index === -1) {
        return { prev: undefined, next: undefined };
    }
    return { prev: series.parts[index - 1]?.post, next: series.parts[index + 1]?.post };
}

export interface OrderedPost {
    path: string;
    entry: {
        id: string;
        data: { published: Date; order?: number | undefined };
    };
}

/** Explicit positions first, then publication date and path for deterministic ties. */
export function comparePostOrder(a: OrderedPost, b: OrderedPost): number {
    const left = a.entry.data.order;
    const right = b.entry.data.order;
    if (left !== right) {
        if (left === undefined) {
            return 1;
        }
        if (right === undefined) {
            return -1;
        }
        return left - right;
    }
    return (
        b.entry.data.published.valueOf() - a.entry.data.published.valueOf() ||
        (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    );
}

/** Manual lists read forward; purely chronological lists retain older/newer navigation. */
export function postNeighbours<T extends OrderedPost>(posts: readonly T[], id: string) {
    const index = posts.findIndex(({ entry }) => entry.id === id);
    if (index === -1) {
        return { prev: undefined, next: undefined };
    }
    const step = posts.some(({ entry }) => entry.data.order !== undefined) ? 1 : -1;
    return { prev: posts[index - step], next: posts[index + step] };
}
