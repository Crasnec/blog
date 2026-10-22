/** Override only when serving developer fixtures; ordinary builds use real posts. */
export const POSTS_DIRECTORY = process.env.BLOG_POSTS_DIR ?? "./src/content/posts";
