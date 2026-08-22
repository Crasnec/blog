/**
 * graphite — code block themes.
 *
 * The third part of a theme, and the one that is not CSS: Shiki themes cannot
 * be expressed as custom properties, so they are named here and picked up by
 * `astro.config.mjs` through `src/theme.config.mjs`.
 *
 * Only the syntax hues come from these. Every surface — background, border, tab
 * bar, line highlight — is overridden in `astro.config.mjs` to the palette's own
 * tokens, so a code block always sits on the theme's paper rather than on
 * Shiki's idea of one.
 *
 * Vitesse is deliberately low-saturation, which is what a page carrying this
 * much prose around its listings needs.
 */

/** @type {import("rehype-expressive-code").ThemeObjectOrShikiThemeName[]} */
export const codeThemes = ["vitesse-light", "vitesse-dark"];

export const DARK_CODE_THEME = "vitesse-dark";
