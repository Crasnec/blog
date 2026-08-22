# Themes

A theme is a folder. Swapping one is one line:

```js
// src/theme.config.mjs
export const THEME = "graphite";
```

`astro.config.mjs` reads that, aliases `@theme` at `themes/<name>/`, and loads
that theme's code themes. Nothing else in the codebase names a theme.

```
themes/<name>/
  palette.css   colour, type stacks, radii          ← the theme
  fonts.css     the @fontsource imports it needs
  code.mjs      Shiki themes for code blocks
```

Two ship: **graphite** (default — warm neutral paper, magenta marker) and
**slate** (cool blue-grey paper, indigo marker). The second one exists to keep
the seam honest. A theme system with one theme in it is an untested claim.

## Switching one

Change `THEME`, then **clear the Markdown cache**:

```bash
rm -rf .astro          # then restart dev
npm run build:clean    # for a build
```

Astro caches rendered Markdown in `.astro/`, and a code block's syntax colours
are baked into that cached HTML by Expressive Code. Changing the theme does not
invalidate it, so without this the palette swaps and the code blocks either keep
the old colours or come out unstyled — which looks like the theme system is
broken when it is only stale.

The same cache is why `build:clean` exists for `src/plugins/` edits.

## The split

`tokens.css` holds everything structural — the type scale, the spacing scale,
layout widths, motion, z-index — and **may not name a colour**. `palette.css` is
loaded after it and holds the colour, so a theme can override a structural
default but the structure can never win over a theme.

If a component needs a colour the palette does not have, the palette gains a
token. That rule is the whole reason a theme swap does not leave a stray hue
behind in some corner nobody thought to check.

## What a palette must define

Both for `:root` and for `:root.dark`, except where noted.

| | |
| --- | --- |
| **Surfaces** | `--paper` `--paper-raised` `--paper-sunk` |
| **Ink** | `--ink-strong` `--ink` `--ink-muted` `--ink-faint` |
| **Rules** | `--rule` `--rule-strong` `--rule-faint` |
| **Marker** | `--marker` `--marker-line` `--marker-wash` `--marker-wash-strong` |
| **Admonitions** | `--warn` `--warn-line` `--warn-wash` `--danger` `--danger-line` `--danger-wash` |
| **Interaction** | `--hover-wash` `--active-wash` |
| **Overlay** | `--scrim` `--shadow-color` — light mode only; see below |
| **Type** | `--font-sans` `--font-mono` |
| **Radii** | `--radius-1` `--radius-2` `--radius-3` |
| **sRGB mirror** | `--hex-bg` `--hex-surface` `--hex-ink` `--hex-ink-muted` `--hex-rule` `--hex-accent` `--hex-accent-soft` |

Four more are derived in `tokens.css` and come free: `--selection-bg`,
`--selection-fg`, `--shadow-menu`, `--shadow-panel`. Override them if you
disagree. Custom properties resolve where they are used rather than where they
are written, so a derived token follows your palette into dark mode on its own.

## Things that are easy to get wrong

**The scrim is darkness, not ink.** `--scrim` and `--shadow-color` stay dark in
both modes — that is why they are set only in the light block. A scrim that
inverted with the theme would light the page up instead of dimming it.

**The `--hex-*` block is a mirror, not a second palette.** Three things on this
site are *rendered* rather than styled — Mermaid diagrams, the social cards and
the favicon — and none of them can read a custom property or make sense of
`oklch()`. `--hex-*` is the same palette written out again in sRGB for them.
Regenerate it whenever the values above change, or a theme swap will leave
diagrams and shared links belonging to the old theme while the page itself has
moved on.

Everything downstream reads it by parsing `palette.css`, so a missing token
fails the build with the name of the one it wanted rather than drawing a card in
whatever colour was left over.

**The marker means one thing.** A theme chooses what colour it is. It does not
get to change what it is *for* — behind the thing you are pointed at, and the
line under a link — because every component was built around that. If your
marker also wants to be the warning colour, pick a different marker.

**Washes are chosen, not mixed.** It is tempting to derive `--marker-wash` from
`--marker` with `color-mix()`. Don't: a linear mix comes out duller than a
highlighter looks, because a highlighter is light *and* saturated at once. Both
shipped themes set them by hand.

**Changing the faces means changing `fonts.css` too**, and adding whatever
`@fontsource` package it needs. The stacks in `palette.css` and the imports in
`fonts.css` are one decision in two files; they drift the moment you forget.

## Not in the folder

Three theme-coloured things live elsewhere, and none of them needs editing when
you add a theme — they all read the palette:

- `src/utils/mark.ts` — the favicon, drawn from the dark block of `--hex-*` and
  emitted as `/favicon.svg`, `/favicon.ico` and `/apple-touch-icon.png`. It was
  a hand-coloured file in `public/` once, which meant a theme swap left the old
  colours sitting in the tab.
- `src/utils/og.ts` — the social cards, drawn from the light block.
- `astro.config.mjs` → `styleOverrides` — maps the palette onto Expressive Code's
  surfaces. It only ever references tokens, so it needs no change per theme.

## Adding one

Copy a folder, rename it, change the values, point `THEME` at it, clear the
cache. Then look at an index, a post with code and a diagram, the search panel
and a comment — in both modes — and at `dist/og/ko.png` and `dist/favicon.svg`,
which are the two that no amount of looking at the site will show you. Anything
that still looks like the old theme is a colour that escaped into a component,
and it belongs in the palette instead.
