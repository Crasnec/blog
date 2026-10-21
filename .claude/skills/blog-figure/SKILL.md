---
name: blog-figure
description: Add or change figures in this Astro blog, including reusable canvas animations, statistical diagrams, and post-specific TSX/SVG figures composed in MDX.
---

Paths below are relative to the repository root. Read `src/figures/README.md`
in full before adding or changing a figure. It is the source of truth for
available kinds, runtime rules, drawing helpers and visual checks.

## Choose the implementation

- Prefer an existing typed component from `src/components/figures/index.tsx`.
  Check its input contract in `src/figures/inputs.ts`; the README lists the
  available mechanism and statistical kinds. For statistical figures, also
  read `src/figures/statistics/README.md` for assumptions, limits and the
  meaning of intervals, reference lines and summary values.
- Keep a post's data, labels and narrative in a neighbouring `_figures/*.tsx`
  component, and import it from MDX. Shared datasets belong there once, rather
  than being repeated for each view. See
  `src/content/posts/build/_figures/LatencyComparison.tsx` for multiple views
  of one dataset. Use `src/figures/generators.ts` for repeatable example inputs
  where appropriate; pass explicit arrays or matrices to reusable components.
- For a unique static drawing, wrap SVG with `src/components/SvgFigure.tsx`
  in the post's TSX component instead of adding a global kind. See
  `src/content/posts/build/_figures/NormalCoverage.tsx` for computed geometry,
  CSS theme colours and an accessible description.
- Render these compositions on the server. Do not add a `client:*` directive
  to `<Figure>`: `src/scripts/figures.ts` already owns its canvas animation,
  replay, resizing, theme changes and reduced-motion behaviour.

## Add a reusable kind only when needed

Read `src/figures/kinds/queue.ts` together with
`src/figures/models/queue.ts` for a complete mechanism example. The old
`checkout.ts` kind is a compatibility alias, not a new-kind template.

Keep reusable computation in `src/figures/models/` or
`src/figures/statistics/`, and keep example workloads outside those modules.
Compute the claimed result from inputs during decoding; `draw` must reproduce
any requested time without retaining state. Comparisons use the same model
with explicit input changes, rather than lane-specific results tuned by hand.
For statistical work, check the relevant numerical module and documented
conventions before introducing a new estimator or interval.

Use `src/figures/kit.ts` helpers for validation, deterministic randomness,
layout and drawing. Add the kind's serializable author input to
`src/figures/inputs.ts` and its named component to
`src/components/figures/index.tsx`. Follow the README's runtime and responsive
layout rules, and cover new numerical behaviour with model regressions.

## Verify the changed figures

Run `npm run check` after figure code changes. When changing runtime or shared
component behaviour, also run `npm run test:figures:browser` against a running
dev server. If one needs starting, use `astro dev --background` as required
by `AGENTS.md`.

For each affected post, capture both widths into separate directories:

```bash
FIGURES_WIDTH=900 FIGURES_OUT=.figures-shots/desktop npm run figures:shot -- /posts/build/my-post/
FIGURES_WIDTH=390 FIGURES_OUT=.figures-shots/phone npm run figures:shot -- /posts/build/my-post/
```

Replace the URL with the actual post path. The script uses a running dev
server or starts and stops a private one. It captures canvas and `SvgFigure`
elements in light and dark; each command clears its output directory, so keep
the widths separate. Fix any reported build or browser errors first.

Open the PNGs and follow the README's checklist. Inspect early frames and the
final frame in both themes at both widths, checking overlap, clipping and
agreement with the caption. For brief events, use `FIGURES_AT` to select the
relevant fractions of the animation's duration. After a visual fix, capture
and inspect the affected figures again before reporting them complete.
