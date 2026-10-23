# Scene authoring kit

Start here when a diagram describes roles, connections or a sequence rather
than a computed quantity. The kit provides 82 prepared visuals, five automatic
layouts and three animation actions. Authors select names and relationships;
the library owns coordinates, line routing, text wrapping and timing.

The complete visual catalog and copyable examples are at
`/posts/build/scene-kit/`. Import `Scene` and `defineScene` from
`src/components/figures`. The generic equivalent is
`<Figure kind="scene" props={input} />`.

## Small author contract

```tsx
const input = defineScene({
    layout: "flow",
    items: [
        { id: "client", visual: "browser", label: "Browser" },
        { id: "api", visual: "server", label: "Application" },
        { id: "data", visual: "database", label: "Database" },
    ],
});

<Scene props={input} caption="A request reaches the application and its database." />
```

`defineScene` infers item IDs and constrains TypeScript parent/step references
to them. It also runs the decoder. Both Figure entry points validate raw JSON
at build time. Use it in TSX examples so editors catch mistakes early.

Each item has a required `id` and `label`. `visual` defaults to `rounded`;
`detail` adds a second text block. `tone` uses the existing semantic palette.
Only hierarchy items may specify `parent`. ID spelling is lowercase a–z,
0–9, underscore or hyphen, starting with a letter, up to 32 characters.

## Layout recipes

| Name | Use | Connections |
| --- | --- | --- |
| `flow` | Request paths, transformations, ordered stages | Adjacent input items |
| `stack` | Layers or a deliberately vertical explanation | Adjacent input items |
| `grid` | Comparison, vocabulary, independent concepts | None |
| `cycle` | A repeating conceptual sequence | Adjacent items, last to first |
| `hierarchy` | Filesystems, ownership or containment | Parent to child |

Flow becomes vertical when a readable horizontal row would not fit. A cycle
becomes a vertical list with a return connection when the circle would not
fit. Hierarchies use stable preorder and indented branches. Grid column
counts depend on available width. Text height is reserved before animation.
Scene rejects Figure's explicit `height`: automatic height is part of the
safe layout contract.

## Motion recipes

- `motion: "flow"` follows connections; without connections it reveals items.
- `motion: "reveal"` introduces each item in order.
- `motion: "none"` shows all items immediately.

For custom order, replace `motion` with `steps`:

```tsx
steps: [
    { action: "focus", target: "client" },
    { action: "transfer", from: "client", to: "api" },
    { action: "reveal", target: "data" },
]
```

Transfers must follow an existing directed connection. Focus and reveal must
reference real items. There are no authored timestamps or coordinates. The
sequence fits an eight-second timeline with a final hold. Animation expresses
conceptual order; it does not claim to simulate physical time or throughput.
For those claims, use the existing queue, sorting, scheduling and other
computed model figures. The runtime retains replay and reduced-motion support.

## Predictable failures

The decoder rejects unknown options, unsupported symbol names, duplicate IDs,
missing targets/parents, parent cycles, impossible transfers, mixed `motion`
and `steps`, more than 16 items/steps, more than five hierarchy levels, and
labels/details longer than 40/64 graphemes. A cycle needs at least three items.
Errors name the field or item. Split large explanations into separate scenes.

The HTML data table preserves every label, detail and parent relationship
without JavaScript. Provide a caption explaining the point of the diagram.

## Workflow for an author or model

1. Choose a working example, then copy its complete TSX component.
2. Select an existing layout and exact visual names from the catalog.
3. Change only content and IDs first. Keep one idea per scene.
4. Add semantic steps if the default sequence needs changing.
5. Run `npm run check`, build, and inspect screenshots at phone and desktop
   widths, in light and dark themes, at intermediate and final frames.

Do not invent a new visual name, pass pixel coordinates or write drawing
callbacks in a post. New visuals belong in `symbols.ts` and must be reviewed
in the generated catalog. `model.ts` validates and lays out; `kinds/scene.ts`
only draws the result. Extending this catalog is preferable to scattering
one-off canvas code through articles.

`test/scenes.test.ts` checks the entire catalog, invalid inputs, graph ordering,
timeline seeking and non-overlapping bounds over all supported item counts
and representative widths. The browser gallery checks actual font bounds,
all prepared paths and screenshots. These checks catch implementation
regressions; authors still review meaning, hierarchy and wording.

To run the browser checks and save inspection images against a fixture build:

```sh
FIGURES_DIST=/absolute/path/to/dist FIGURES_OUT=/tmp/figure-kit-shots \
    node --test test/basic-charts.browser.ts
```

This routes the built pages directly in Playwright and starts no dev server.
