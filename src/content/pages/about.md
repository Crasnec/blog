---
title: About
description: About this blog and the ideas behind its design.
---

This is a personal Astro blog for long-form engineering writing. It is built to make detailed articles pleasant to read and straightforward to publish.

## What belongs here

The blog is a place for problems encountered while building software: what failed, how it was investigated, and why one solution was chosen over another. Topics can range from backends and databases to build systems, developer tools, and team practices.

Articles are written in Markdown or MDX and published as a static site. The format supports highlighted code, diagrams, mathematics, tables, footnotes, and callouts without requiring a separate editor or content service.

## The map beside each post

The small strip beside a title is a visual map of the article. It is generated from the document structure and shows the balance and position of different kinds of content.

- Thin lines represent paragraphs.
- Solid blocks represent code.
- Outlined blocks represent diagrams.
- Vertical marks show where sections begin.

The map offers a quick sense of whether an article is mostly explanation, code, or visual material before opening it.

## How the site is run

Astro validates the content collection and generates the pages at build time. Pagefind adds static search, and GitHub Pages hosts the final output. Optional encrypted posts and repository-backed comments add private publishing and moderated discussion without an application server.

For the practical workflow, read [Writing and Publishing a Post](/posts/writing-and-publishing). The project's README contains the complete setup and maintenance reference.

## Contact

If you find an error, open an issue or get in touch through [GitHub](https://github.com/Crasnec). A reproducible example is always welcome.
