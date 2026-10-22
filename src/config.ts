/**
 * Site-wide configuration.
 *
 * Everything a new owner needs to change lives in this file. Rename the site,
 * point `url` at your domain, and replace the profile block — nothing else in
 * the codebase hard-codes these values.
 */

import type { Locale } from "./locales/index.ts";

export const siteConfig = {
    /** Interface language. Does not translate posts or change their URLs. */
    locale: "ko" satisfies Locale,

    /** Absolute site URL. Required for the sitemap and canonical links. */
    url: "https://crasnec.github.io",

    /** Shown in the masthead and in <title>. */
    title: "Notes",

    /** One line under the title. Keep it short; it sits on a single line. */
    subtitle: "Problems I ran into while building, and what fixing them taught me",

    description:
        "Long-form engineering notes on backends, build tooling and databases — written from things that actually broke.",

    /** Posts per page on the index. */
    postsPerPage: 6,

    /** Deepest heading level that reaches the contents (2 = h2 and h3). */
    tocDepth: 2,
} as const;

export const profileConfig = {
    name: "Crasnec",
    bio: "I build backends and developer tooling. Most of what is here exists so I do not have to debug the same thing twice.",
    links: [{ name: "GitHub", url: "https://github.com/Crasnec" }],
} as const;

/**
 * Comments.
 *
 * They live in their own public GitHub repository — never in this one — and a
 * reader posting one starts a workflow there that validates it and commits a
 * file. That repo holds data only, so spam never reaches this history, no site
 * build is triggered per comment, and the whole store can be discarded and
 * recreated if it is ever flooded.
 *
 * The token that starts that workflow ships to the browser and must be scoped
 * to the comment repository alone, with Actions write and nothing else. That
 * permission cannot write repository contents directly, but it does expose the
 * repository's Actions API; see the security note in the README. It is read
 * from `PUBLIC_COMMENTS_TOKEN` rather than written here, so rotating it is a
 * deploy variable and not a commit.
 *
 * The repository and token are both read where the form is rendered. Keeping
 * environment access out of this module matters because Astro also imports it
 * while evaluating `astro.config.mjs`, before Vite has populated
 * `import.meta.env`.
 */
export const commentsConfig = {
    /** Workflow file in that repository that receives a comment. */
    workflow: "comment.yml",

    /** Branch the workflow runs on. */
    branch: "main",

    /**
     * Rejected past this length — counted on the source Markdown, shown live in
     * the form, and enforced again in the workflow, which is the one that counts.
     */
    maxBody: 2000,
    maxAuthor: 60,
} as const;

/* Coarse to fine: everything, then by date, then by area, then by technology. */
export const navLinks = [
    { key: "nav.posts", href: "/" },
    { key: "nav.archive", href: "/archive" },
    { key: "nav.categories", href: "/categories" },
    { key: "nav.series", href: "/series" },
    { key: "nav.tags", href: "/tags" },
    { key: "nav.about", href: "/about" },
] as const;
