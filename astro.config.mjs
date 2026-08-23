// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

import {
	expressiveCodeOptions,
	rehypePlugins,
	remarkPlugins,
	themeDir,
} from "./src/markdown.config.mjs";
import { siteConfig } from "./src/config.ts";

export default defineConfig({
	site: siteConfig.url,
	trailingSlash: "ignore",
	redirects: {
		"/posts/markdown-and-mdx-features":
			"/posts/build/markdown-and-mdx-features",
		"/posts/private-posts-and-comments":
			"/posts/backend/private-posts-and-comments",
		"/posts/welcome-to-the-blog": "/posts/build/welcome-to-the-blog",
		"/posts/writing-and-publishing":
			"/posts/team/writing-and-publishing",
	},


	// Expressive Code must be registered before MDX so that MDX inherits it.
	integrations: [
		expressiveCode({
			...expressiveCodeOptions,
			plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
		}),
		mdx(),
		sitemap({
		}),
	],

	markdown: {
		/*
		 * `unified()` is the processor object Astro 7 expects, and the plugins
		 * come from `src/markdown.config.mjs` because the sealing script needs the
		 * same list. It matters that they are declared here rather than in the
		 * deprecated top-level `markdown.remarkPlugins`: the Expressive Code
		 * integration appends its own rehype plugin to this array, so everything
		 * below runs before it — which is what lets `remarkMermaid` claim
		 * ```mermaid fences before Expressive Code tries to highlight them.
		 */
		processor: unified({ remarkPlugins, rehypePlugins }),
	},

	build: { format: "directory" },

	vite: {
		resolve: {
			alias: {
				"@theme": fileURLToPath(themeDir).replace(/[\\/]$/, ""),
			},
		},
		build: {
			// Mermaid is large; keep it in its own async chunk.
			chunkSizeWarningLimit: 1600,
		},
	},
});
