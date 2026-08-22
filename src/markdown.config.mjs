/**
 * How Markdown becomes HTML.
 *
 * There are two callers now. Astro renders every ordinary post through this
 * during the build, and `scripts/secret.mjs` renders a locked one through the
 * same set at the moment its author seals it. A locked post's HTML is produced
 * once, by whoever wrote it, and is never rendered again — the build only ever
 * sees ciphertext — so the one thing that keeps a locked post looking like the
 * rest of the site is that both callers agree on the pipeline. This file is
 * that agreement, and it is why the plugin list does not live in
 * `astro.config.mjs` any more.
 */
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";

import { rehypeTableScroll } from "./plugins/rehype-table-scroll.mjs";
import { remarkBlocks } from "./plugins/remark-blocks.mjs";
import { remarkExcerpt } from "./plugins/remark-excerpt.mjs";
import { remarkMermaid } from "./plugins/remark-mermaid.mjs";
import { remarkReadingTime } from "./plugins/remark-reading-time.mjs";
import { THEME } from "./theme.config.mjs";

/**
 * The active theme's folder. `astro.config.mjs` aliases `@theme` at it so the
 * stylesheets can import a palette without naming one.
 */
export const themeDir = new URL(`./styles/themes/${THEME}/`, import.meta.url);

const { codeThemes, DARK_CODE_THEME } = await import(
	new URL("code.mjs", themeDir).href
);

/** Named so a sealed post can record which theme drew its code blocks. */
export const themeName = THEME;

/**
 * Expressive Code, as the Astro integration takes it and as the bare rehype
 * plugin takes it — the shapes are the same, which is what lets the sealing
 * script produce the code blocks the build would have produced.
 */
export const expressiveCodeOptions = {
	themes: codeThemes,
	themeCssSelector: (/** @type {(typeof codeThemes)[number]} */ theme) =>
		theme.name === DARK_CODE_THEME ? ":root.dark" : ":root:not(.dark)",
	defaultProps: { showLineNumbers: false, wrap: false },
	styleOverrides: {
		borderRadius: "3px",
		borderWidth: "1px",
		borderColor: "var(--rule)",
		codeBackground: "var(--paper-sunk)",
		codeFontFamily: "var(--font-mono)",
		codeFontSize: "0.8125rem",
		codeLineHeight: "1.7",
		uiFontFamily: "var(--font-mono)",
		uiFontSize: "0.75rem",
		codePaddingBlock: "1rem",
		codePaddingInline: "1.15rem",
		frames: {
			shadowColor: "transparent",
			editorTabBarBackground: "var(--paper-sunk)",
			editorTabBarBorderBottomColor: "var(--rule)",
			editorActiveTabBackground: "var(--paper-raised)",
			editorActiveTabBorderColor: "var(--rule)",
			editorActiveTabIndicatorTopColor: "var(--marker)",
			editorActiveTabForeground: "var(--ink)",
			editorTabBorderRadius: "0",
			terminalBackground: "var(--paper-sunk)",
			terminalTitlebarBackground: "var(--paper-sunk)",
			terminalTitlebarBorderBottomColor: "var(--rule)",
			terminalTitlebarForeground: "var(--ink-muted)",
			inlineButtonBackground: "var(--ink)",
			inlineButtonForeground: "var(--ink-muted)",
			tooltipSuccessBackground: "var(--marker)",
		},
		lineNumbers: {
			foreground: "var(--ink-faint)",
		},
		/*
		 * A highlighted line inside a code block is the same gesture as a
		 * highlighted post on the index, so it uses the same wash. Diffs keep
		 * a red for removals because +/- is a convention worth not breaking,
		 * but both are pulled down to the volume of the surrounding page.
		 */
		textMarkers: {
			markBackground: "var(--marker-wash)",
			markBorderColor: "var(--marker-line)",
			insBackground: "var(--hover-wash)",
			insBorderColor: "var(--rule-strong)",
			delBackground: "var(--danger-wash)",
			delBorderColor: "var(--danger-line)",
		},
	},
};

/** @type {import("@astrojs/markdown-remark").RemarkPlugins} */
export const remarkPlugins = [
	remarkMath,
	remarkDirective,
	remarkBlocks,
	remarkMermaid,
	// Wraps each heading and its content in a <section>, which is what
	// the contents rail's IntersectionObserver watches.
	remarkSectionize,
	remarkReadingTime,
	remarkExcerpt,
];

/** @type {import("@astrojs/markdown-remark").RehypePlugins} */
export const rehypePlugins = [
	[rehypeKatex, { strict: false, throwOnError: false, trust: true }],
	rehypeSlug,
	[
		rehypeAutolinkHeadings,
		{
			behavior: "append",
			properties: {
				class: "heading-anchor",
				ariaHidden: "true",
				tabIndex: -1,
			},
			content: { type: "text", value: "#" },
		},
	],
	rehypeTableScroll,
];
