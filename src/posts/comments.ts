import { type CollectionEntry, getCollection } from "astro:content";

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
        .filter((entry) => entry.data.approved && entry.data.post === postKey)
        .sort((a, b) => a.data.published.valueOf() - b.data.published.valueOf());
}
