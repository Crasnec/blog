/**
 * slate — code block themes.
 *
 * Github's own pair rather than Vitesse: cooler and a little more saturated,
 * which sits better on this palette's blue-grey paper. Only the syntax hues
 * come from here — every surface is overridden in `astro.config.mjs` to the
 * palette's tokens.
 */

/** @type {import("rehype-expressive-code").ThemeObjectOrShikiThemeName[]} */
export const codeThemes = ["github-light", "github-dark-dimmed"];

export const DARK_CODE_THEME = "github-dark-dimmed";
