# Module boundaries

Routes stay in Astro's `src/pages/` convention. Domain logic and browser behavior
live outside routes, so a page composes existing modules instead of implementing
another version of sorting, execution, or drawing.

| Location | Responsibility | Execution environment |
| --- | --- | --- |
| `src/pages/` | URLs, pagination and static endpoints | Build/server |
| `src/views/`, `src/layouts/` | Page composition and shared shells | Build/server |
| `src/components/` | Public Astro/TSX author components and reusable markup | Build/server, unless explicitly hydrated |
| `src/posts/queries.ts` | Visible posts, metadata, tags and collection queries | Astro build/server |
| `src/posts/comments.ts` | Approved comments and the per-build query cache | Astro build/server |
| `src/posts/category.ts` | Folder-derived category hierarchy | Node/build |
| `src/posts/series.ts`, `post-order.ts` | Ordering, series membership and metadata validation | Pure domain logic |
| `src/scripts/` | Stable bundle and compatibility entries | Browser |
| `src/site/` | Page lifecycle, navigation, theme, reading and search | Browser |
| `src/playground/` | Editor, output, execution workers and notebook sessions | Browser/workers |
| `src/figures/` | Author inputs, pure models, drawing and canvas lifecycle | Build and browser; see below |
| `src/plugins/` | Markdown/HTML transformations | Build/server |
| `src/utils/` | Small cross-feature helpers and old-path compatibility exports | Depends on helper |
| `src/styles/` | Shared tokens, component styles, prose, motion and themes | CSS |

## Module paths

Use package import aliases with explicit file extensions:

```ts
import { t } from "#src/strings.ts";
import Figure from "#src/components/Figure.astro";
import { serveStaticSite } from "#root/test/helpers/static-site.ts";
```

`#src/` resolves from `src/`; `#root/` resolves from the repository root.
Both are declared once in `package.json` and work in Astro, TypeScript and
Node's test runner without an extra loader. Keep npm and `astro:` imports
unchanged. ESLint rejects relative static imports, re-exports and dynamic
imports. Use the same aliases in MDX and documentation examples.

Resource paths are different: `new URL(..., import.meta.url)` for workers,
`import.meta.glob()` patterns, CSS imports, URLs and Markdown links retain
paths relative to the file that owns them. Vite uses those resource paths
for dependency discovery and asset rewriting.

## Import direction

Pages, views and components consume domain modules. Domain modules do not import
pages or views. Browser modules must not import `astro:content`, post queries,
Node APIs, or the server-only compatibility modules in `utils/`.

Keep shared worker contracts independent of the DOM and runtime implementations.
Use type-only imports for types. Decode JSON and structured-clone messages at the
boundary before passing data to domain code.

A compatibility file re-exports its implementation. The implementation must never
import that compatibility file, which would create a circular dependency. Within
a module family, import the specific sibling implementation rather than its public
barrel. Do not add a global barrel that combines server and browser modules.

## Page lifecycle

`src/scripts/ui.ts` starts `site/lifecycle.ts` once. Each `astro:page-load` mounts
the new document's theme control, scroll targets, navigation and search panel.
Global shortcuts and scroll listeners are registered once and use current DOM
references. `astro:after-swap` marks the initial entrance animation as spent.

`site/enhancements.ts` loads optional reading features only when the page contains
them. Editors load near the viewport or on focus. A navigation invalidates pending
imports from the previous document. Feature modules own teardown on
`astro:before-swap`; workers, observers, timers and object URLs must be released.

Search is split between `site/search/engine.ts` (Pagefind loading and response
validation) and `dialog.ts` (focus, modal state and results). Failure to load the
index must remain recoverable on a later search.

## Playground

`playground/mount.ts` connects markup to editors, output and run/stop controls.
`editor.ts` owns editing; highlighting has its own worker and document cache.
`notebook.ts` owns shared Python sessions. JavaScript and Python execution workers
remain separate from the UI and from highlighting.

`playground/contracts.ts` is the stable shared API. Its implementations are:

- `contracts/types.ts`: configuration and message shapes.
- `contracts/limits.ts`: code, input, output and image bounds.
- `contracts/config.ts`: author configuration validation.
- `contracts/run.ts`: execution and input message validation.
- `contracts/highlight.ts`: highlighting message validation.
- `contracts/readers.ts`: internal boundary guards.

Changing a contract requires checking the producer and consumer, including stop,
empty output, input prompts, notebook reuse and page navigation.

## Figures

Author-facing imports stay stable: `components/Figure.astro`, `components/Figure`,
`components/figures`, `figures/kit.ts` and `figures/generators.ts`.

`figures/kit.ts` re-exports small `core/` modules for definitions, timing, data,
geometry, drawing, text, palettes and decoding. None depends on the runtime,
components, individual figure kinds or post data. A figure draws the entire frame
from time and explicit inputs; sampling uses a seed so seeking is deterministic.

`figures/runtime.ts` owns lazy kind loading, canvas sizing, animation, visibility,
replay and theme changes. `kinds/` decodes and draws individual figure types;
`models/` and `statistics/` contain the reusable computations.

The Scene kit separates `types.ts`, `decode.ts`, `layout.ts`, `timeline.ts` and the
prepared `symbols.ts` catalog. `scene/model.ts` remains the stable entry. Charts
similarly separate validation, data types and numeric geometry behind
`charts/model.ts`. Renderers use these results for both drawing and static data
tables; they must not independently recompute an incompatible value.

Example datasets and narratives belong beside their MDX posts, not in the library.
See [the figure guide](../src/figures/README.md), [Scene recipes](../src/figures/scene/README.md)
and [chart conventions](../src/figures/charts/README.md).

## Styles

`styles/global.css` retains the stylesheet order. `styles/components.css` is an
ordered import list for listing, sidebar, contents, article, search, comments,
gates and intro styles. This preserves the original cascade. Shared theme tokens
remain in `tokens.css` and theme files; prose and figures remain in `prose.css`.

## Verification

Run `npm run check` and `npm run build` in both the blog and template. Browser
regressions can use a production build through Playwright request routing without
starting a server:

```sh
npm run test:search:browser
npm run test:contents:browser
FIGURES_DIST=/path/to/template/dist npm run test:figures:browser
FIGURES_DIST=/path/to/template/dist FIGURES_OUT=/tmp/figure-shots \
    node --test test/basic-charts.browser.ts
PLAYGROUND_DIST=/path/to/template/dist npm run test:playground:browser
SERIES_DIST=dist npm run test:series:browser
```

The figure/playground build must contain the example posts. The template includes
them; the blog keeps them under `src/fixtures/posts/`. Always inspect figure
screenshots, including mobile widths and both themes, before finishing a drawing
change. Close browser contexts after checks. If a dev server is needed, use
`astro dev --background` and stop it when done.
