/**
 * The active theme.
 *
 * This is the only place the choice is written down. `astro.config.mjs` reads
 * it to alias `@theme` at the folder below and to pick up that theme's code
 * themes, so both the CSS and the syntax highlighting follow one line.
 *
 * Themes live in `src/styles/themes/<name>/`. See the README there for what a
 * theme has to define.
 */
export const THEME = "graphite";
