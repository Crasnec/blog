---
title: Writing and Publishing a Post
published: 2026-08-21
description: The shortest path from a Markdown file to a finished article on GitHub Pages.
category: team
tags: [writing, markdown, publishing]
---

Every article begins as a Markdown or MDX file in `src/content/posts`. Its full path below that directory becomes the URL, so `src/content/posts/build/tools/small-reliable-tools.md` is published at `/posts/build/tools/small-reliable-tools`.

## Add the frontmatter

Start a post with a small block of metadata:

```yaml title="src/content/posts/build/tools/small-reliable-tools.md"
---
title: Small, Reliable Tools
published: 2026-08-22
description: Why a narrow tool is often easier to trust and maintain.
category: build
tags: [design, tooling]
---
```

`title`, `published`, and `category` are required. A description supplies the summary used on listing pages and in page metadata. Tags are free-form and may be omitted.

The category must be one of the keys defined in `src/config.ts`. Keeping that list explicit prevents a typo from silently creating a nearly empty category.

## Write the body

Continue below the frontmatter with normal Markdown. Headings create the table of contents, fenced code blocks gain syntax highlighting, and links to headings are added automatically.

```md
## Begin with the problem

Explain what the reader should understand or be able to do.

## Show the useful details

Prefer a small working example over a large abstract one.
```

Use `.mdx` only when the article needs imported components or expressions. A regular `.md` file is simpler and covers most posts.

:::tip
Write the description after the article. A good description states the question answered by the post instead of repeating its title.
:::

## Preview before publishing

Install dependencies once, then start the local server:

```bash
npm install
npm run dev
```

The development server updates the page as the source changes. Before committing, run the project checks and a production build:

```bash
npm run check
npm run build
```

The content collection validates frontmatter during these commands. A missing field or unknown category fails early instead of producing a broken page.

## Control visibility

Add `draft: true` to keep unfinished writing out of a production build. Remove it, or set it to `false`, when the post is ready.

For content that should be listed publicly but readable only with a passphrase, use the private-post workflow described in [Private Posts and Moderated Comments](/posts/backend/private-posts-and-comments).

Once the checks pass, commit and push the source. The included GitHub Actions workflow builds the site and deploys the generated files to GitHub Pages.
