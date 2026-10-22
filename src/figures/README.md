# Animated figures

Canvas figures that draw themselves when they scroll into view. A post places
one with `<Figure>`; the drawing lives in `kinds/<name>.ts`.

```mdx
import Figure from "../../../components/Figure.astro";

<Figure
	kind="line"
	caption="p99 spikes after deployment and falls only after rollback."
	props={{ series: [{ label: "p99", values: [180, 190, 640, 720, 300, 185] }] }}
/>
```

The import path climbs one `../` per directory between the post and `src/`.
`src/content/posts/build/x.mdx` needs three.

`src/content/posts/build/animated-figures.mdx` introduces `line`,
`distribution`, `flow`, `queue` and post-specific TSX compositions. Read it at `/posts/build/animated-figures/`.

## Typed components for all 44 reusable kinds

Import a named TSX component from `src/components/figures`. Every component
accepts `props` with that kind's input type, plus `caption`, `label` and
`height`. Inputs and their names live in `src/figures/inputs.ts`. For example:

```tsx
import { Sort, Heatmap, Boxplot } from "../../../../components/figures";

<Sort props={{ algorithm: "merge", values: [-3, 2, 0, -1] }} />
<Heatmap props={{ rows: ["A"], cols: ["x", "y"], values: [[4, 4]] }} />
<Boxplot props={{ groups: [{ label: "A", values: [1, 2, 3, 8] }] }} />
```

The fourteen mechanism/data components are `Line`, `Distribution`, `Flow`,
`Sequence`, `StateMachine`, `Sort`, `GridSearch`, `HashRing`, `Tree`, `Gantt`,
`Heatmap`, `Memory`, `HexEditor` and `Queue`. The thirty statistical components use the
PascalCase version of the kind name, with `ECDF`, `QQ`, `KDE`, `PP`, `ACF`,
`PACF` and `ROC` capitalized. The index exports the full list. `<Figure>` is
also available for newly added kinds and for old JSON shorthand inputs.

All demo posts now import their story figures from `_figures/*.tsx`; the MDX
contains the surrounding prose. Repeated workloads such as the same maze,
job list or allocation requests are defined once per post. Story components
accept an optional full `props` replacement and caption/label/height overrides.
They do not merge nested inputs. The statistical gallery's data is in
`src/content/posts/build/_figures/statistics-data.ts`, outside the library.

The boundaries are:

- `src/figures/inputs.ts`: serializable author inputs.
- `src/figures/models/`: sorting, grid search, trees, hash ownership,
  scheduling, allocation, threshold state transitions and queues, reusable
  without a DOM or canvas. `models/index.ts` exports their entry points.
- `src/figures/generators.ts`: deterministic author-side sampling and
  workload helpers. New examples pass the resulting arrays to components.
- `src/figures/statistics/`: the statistical models and renderers, with no
  example data. `kinds/` validates inputs and draws each kind's result.
- `src/content/posts/build/_figures/`: post data, captions and TSX composition.

The old `count`/`seed`, generated tree values, distribution `generate`,
`daily-peak` heatmap shorthand and `checkout` alias remain compatible. The
traffic and checkout presets live under `presets/`; the typed components take
explicit arrays and matrices. The `checkout` preset is the compatibility story.

`/posts/build/figure-data-inputs/` demonstrates signed lines/distributions,
signed and zero-only sorting, a constant matrix, actual key names and an
unreachable maze. Numeric axes fit negative and constant data automatically.
`Line` supports 1–8 series with 2–2000 values each; `Distribution` supports
1–4 groups with 1–2000 samples each. Both limit magnitude to 1e12.
Line endpoint value labels can be hidden with `showValues: false` when
several curves end close together; this defaults to `true`. Their
explicit axis bounds must be ordered; a line's bounds must enclose its data,
while distribution values outside its bounds pile into the end bins. `Sort`
accepts 2–40 values of magnitude at most 1e12, including ties and negatives;
value labels are omitted when they cannot fit their slots. `HashRing` takes
1–40 distinct nonempty key strings, at most 128 characters each. `GridSearch`
shows a no-path result after exhausting the reachable cells when no path exists.

## Compose a post-specific figure in TSX

Both `Figure.astro` and `Figure.tsx` accept the same props. A reusable kind
accepts data and drawing options; it must not own a post's example workload,
service names or narrative. Keep those in a TSX component beside the post.
For example, from `src/content/posts/build/_figures/WorkerQueues.tsx`:

```tsx
import Figure from "../../../../components/Figure";

export default function WorkerQueues() {
  return <Figure kind="queue" props={{
    servers: 2,
    arrivals: [0, 0, 1, 2],
    services: [5, 1, 1, 1],
    entryLabel: "Arrivals",
    doneLabel: "Completed",
  }} caption="The same workload runs through dedicated and shared queues." />;
}
```

Import it in the neighbouring MDX:

```mdx
import WorkerQueues from "./_figures/WorkerQueues.tsx";

<WorkerQueues />
```

Use several `<Figure>` elements in one TSX component when one data set needs
multiple views; `_figures/LatencyComparison.tsx` demonstrates ECDF and boxplot.
Use `<SvgFigure>` and normal SVG elements when the drawing is unique to the
post; `_figures/NormalCoverage.tsx` is a working example with computed density
and probability. It needs no entry in `kinds/`.

These examples render on the server, with no `client:*` directive. Canvas
animation still belongs to the existing runtime, including replay, seeking,
reduced motion, resizing and theme changes. Static SVG uses CSS theme tokens
and works without JavaScript. Interactive React components with event handlers
can use Astro's client directives separately; do not hydrate `<Figure>`, since
the canvas runtime already owns its DOM. See the [Astro framework component
guide](https://docs.astro.build/en/guides/framework-components/).

## Pick a kind first

Most figures do not need new code. Try these first.

| Kind | Use it for | Loops |
| --- | --- | --- |
| `line` | a metric over time: traffic, latency, memory, an incident | no |
| `distribution` | how values spread: response times, tails, p50 against p99 | no |
| `flow` | where requests go: services, queues, caches, timeouts | yes |
| `sequence` | messages between parties over time: handshakes, retries, lost packets, timeouts | no |
| `state-machine` | a system moving between states on events: circuit breakers, connection or order lifecycles | no |
| `sort` | an algorithm working on an array, replayed from a real trace: comparisons and swaps | no |
| `grid-search` | search on a grid, replayed from the real search: BFS, DFS, greedy, A* | no |
| `hash-ring` | where keys land when servers change: consistent hashing against `hash % N` | no |
| `tree` | a tree being built or searched, replayed from the real operation: BST insert and search, heap insert | no |
| `gantt` | work laid out on a timeline, from a real scheduler: FCFS, SJF, round robin, several cores | no |
| `heatmap` | a matrix of values revealed over time, with the hottest cells ranked: latency by day and hour | no |
| `memory` | an allocator placing and freeing blocks, from a real run: first/best/worst/next fit, fragmentation | no |
| `hex-editor` | selections and byte replacements in offset, hexadecimal and printable ASCII views of one buffer | no |
| `queue` | the same arrival/service workload under dedicated and shared FCFS queues | no |
| `checkout` | compatibility preset for old posts; new posts compose `queue` in TSX | no |

Each kind above documents its props at the top of its file, and has a published
demo post at `/posts/build/figure-<kind>/` (`queue`, `checkout` and the first three are
in `/posts/build/animated-figures/`).

Thirty statistical kinds are also available: scatter, boxplot, violin, ECDF,
Q–Q, intervals, KDE, beeswarm, raincloud, boxen, ridgeline, P–P, hexbin,
density contours, pairplot, jointplot, forest, funnel, Bland–Altman, mosaic,
residuals, scale–location, influence, ACF, PACF, lag, Kaplan–Meier, ROC,
precision–recall and calibration. Their exact `kind` names, input contracts,
limits and statistical conventions are in
[`statistics/README.md`](statistics/README.md). The published guide at
`/posts/build/statistical-figures/` contains a working example of all thirty.

Write a new kind only when the idea is a mechanism none of these can show,
such as a queue building up, a traffic jam spreading back, or a retry storm.
The kinds above are also worth reading for their shapes: a timeline down the
page (`sequence`), boxes and curved arrows (`state-machine`), bars that move
(`sort`), a square-celled board (`grid-search`), a circle (`hash-ring`), a
tree (`tree`), a timeline (`gantt`), a colour ramp (`heatmap`) and a strip of
blocks (`memory`).

### `line`

| Prop | Type | |
| --- | --- | --- |
| `series` | `{ label, values: number[], tone? }[]` | required. The first is `marker`, the rest `muted`, unless `tone` says otherwise |
| `xLabels` | `string[]` | spread evenly under the axis, ends included |
| `unit` | `string` | shown top left, e.g. `"RPS"` or `"p99 (ms)"` |
| `yMin`, `yMax` | `number` | automatically enclose signed or constant data; explicit bounds must enclose all values |
| `notes` | `{ at: index, text }[]` | a dashed line and label at `values[at]`, shown as the pen passes |

### `distribution`

| Prop | Type | |
| --- | --- | --- |
| `min`, `max` | `number` | default to the sample range including zero; out-of-range samples pile into the end bins |
| `groups` | `{ label, samples?, generate?, outliers? }[]` | required. One panel each, side by side |
| `generate` | `{ count, median, spread?, seed? }` | log-normal samples. `spread` 0.2 is tight, 0.6 is wide |
| `outliers` | `number[]` | added on top of the samples, for a deliberate tail |
| `markers` | `("p50" \| "p99" \| number)[]` | dashed percentile lines, drawn after the dots land |
| `unit` | `string` | appended to axis values and markers |
| `bins` | `number` | default 48 |

The upper 5% of each group are drawn in the marker colour.

### `flow`

| Prop | Type | |
| --- | --- | --- |
| `nodes` | `{ id, label, x, y, sub?, tone? }[]` | `x` and `y` are 0–1 across the canvas. `sub` is a small second line |
| `edges` | `{ from, to, rate?, drop?, label?, tone? }[]` | `rate` is packets per second (default 1.5). `drop` 0–1 is the share that fails at the far end |

A node with `tone: "warn"` or `"danger"` gets a coloured border. On a narrow
screen an edge label that is longer than its edge is left out, so do not put
the only explanation in a label.

### `queue`

`servers` is an integer from 2 to 4. `arrivals` contains 1–14 ordered times
from 0 to 1e6; ties keep input order. `services` contains the same number of
durations, each from 1e-6 to 1e6 in the same unit. Each policy sees the same
workload. Dedicated queues choose the least populated server, including the
job in service; ties choose the lowest index. Shared queues are FCFS and choose
the earliest available server, breaking ties by index. Jobs do not switch
queues. Service is non-preemptive.

Optional `policies` contains 1–2 unique `{ policy: "per-server" | "shared",
label: string }` entries. Defaults compare both. `unit`, `entryLabel`,
`doneLabel` and `waitingLabel` change the displayed text. `highlight: {index,
label}` rings a particular job. `warnAfter` (1.2) and `dangerAfter` (2.4) set
wait-colour thresholds in the input's unit; require 0 < warn < danger.

The whole trace fits the animation automatically. Mean and maximum waits are
computed in original time units, before fitting. The legacy `checkout` kind
uses `presets/checkout.ts` to translate its old props to this workload.

### `hex-editor`

`bytes` contains 1–64 integer values from 0 to 255. Optional `actions` has at
most twelve `{ op: "select", index, label? }` or `{ op: "write", index, value,
label? }` entries. An index is a zero-based position in `bytes`; a write
selects its target and replaces one byte without inserting or deleting data.
The decoder rejects unknown fields and invalid action/value combinations.

`baseOffset` defaults to 0 and sets the displayed address of `bytes[0]`.
The last byte's address must fit an unsigned 32-bit integer. `selected` is
the initial index (default 0); `title` is an optional label of up to 48
characters. Action labels accept at most 80 characters and truncate to fit.
An omitted or empty `actions` array gives a static buffer with an inspector.

The hex and ASCII columns read one immutable snapshot and change at the same
instant. Printable ASCII is 0x20–0x7E; other bytes display a middle dot. This
is not a UTF-8 decoder. Modified bytes have an underline, and the inspector
shows the selected address, hexadecimal value, decimal value and eight bits.
The row width adapts to four, eight or sixteen bytes while preserving every
byte. `models/hex-editor.ts` exports `traceHexEditor` for other renderers.
The working guide is `/posts/build/figure-hex-editor/`.

### Common props of `<Figure>`

- `caption`: say what to watch for, not what the figure is. "B's p99 is four
  times A's" is more useful than "Response-time distribution".
- `label`: the text screen readers get. Defaults to the caption.
- `height`: canvas height in px, if the kind's default does not suit.

Props are checked when the site builds. A wrong prop fails the build with the
path of the field, e.g. `<Figure kind="line">: props.series[1].values must be
an array of numbers`. Read the message and fix that field.

## Writing a new kind

A kind is one file in `kinds/`. Its file name is its `kind`. For a reusable
public TSX entry point, add its raw input to `inputs.ts` and export its named
component from `components/figures/index.tsx`. Story-only drawings stay in the
post's TSX files and do not need a kind.

Read `kinds/queue.ts` with `models/queue.ts` for a complete example. The
queue model contains scheduling arithmetic, the kind validates inputs and
draws the result, and the post's `_figures/CheckoutComparison.tsx` supplies its
story data. New kinds follow this structure:

1. `TIMES`: the pacing in seconds, in one object. Change it here and nowhere
   else.
2. `simulate()`: what happens to every moving thing (when it arrives, starts,
   finishes, fails). It depends only on the props, so it runs once in
   `decode` and `draw` only looks things up.
3. `decode`: props with defaults and range checks, then the simulation. A
   check that the story finishes before the ending is shown means a bad
   combination of props fails the build instead of cutting the figure short.
4. `draw`: layout from `width` and `height` with a `narrow` variant, then
   numbered layers from back to front. Repeated parts (two lanes, several
   panels) go in a function called once per part. Each moving thing answers
   one question, "where is it at `time`?", from its own timestamps.

It also shows the small things that are easy to get wrong:

- People in a line have their own positions instead of piling on one point,
  and the line shuffles forward smoothly because the position is a
  fractional count of who is still ahead.
- Colour carries a quantity that grows while you watch (`heat`), and things
  keep that colour after they leave, so the final frame still shows it.
- The final frame is not empty. Finished items collect somewhere visible.
- Each lane ends on a value ("mean 0.5s · max 1.3s") rather than a sentence,
  and the comparison is coloured: the better one in `marker`, the worse in
  `danger`.

### The kit at a glance

Everything below is in `kit.ts`. Reach for these before writing your own.

| Need | Helpers |
| --- | --- |
| When does a step happen | `progress`, `between`, `stagger`, `phases` |
| How does it move | `ease.linear` / `out` / `inOut` / `back` / `sine` / `expo`, `lerp`, `clamp` |
| Something that blinks or breathes | `flash` (once), `pulse` (forever) |
| A number that counts up | `countUp`, `compact` (1200 → "1.2k"), `trimNumber` (7.0 → "7") |
| Random but repeatable | `random(seed)`, `normal`, `lognormal`, `arrivals`, `pick`, `hash32` (a string's place, for keys and servers) |
| Summaries | `sum`, `mean`, `percentile` |
| Axes | `scale`, `niceMax`, `tickStep` (round tick spacing) |
| Layout | `canvasRect`, `inset`, `rows`, `cols`, `center`, `gridCell`, `fitAspect` (square cells at any width), `polar` (a point on a circle) |
| Moving along a route | `along` (one segment), `alongPath` (several), `partialPath` (a line drawing itself) |
| Shapes | `line`, `arrow`, `arrowHead`, `curvedArrow` (bent, can grow in), `arc`, `dot`, `ring`, `box`, `chip` (a numbered tile), `edgePoint` (where a line leaves a box) |
| Fills | `hatch` (taken but idle: waiting, reserved), `rampFill` (a value on a surface → marker ramp) |
| Curves | `bendPoint`, `alongCurve` (move along a curved arrow) |
| Gauges | `bar` (a fraction), `cells` (a count against a limit) |
| Text | `text`, `fittedText` (truncate within a width), `label` (on a plate, flips at the edge), `badge` (a tag), `labelSpot` + `slantedLabel` (a label along a line, at the point clear of other lines) |
| Status | `burst` (something failed), `heat` (ink → warn → danger by value), `toneColor` |
| Opacity | `withAlpha` (fade a group without resetting `globalAlpha` by hand) |

A kind whose right height depends on its width, such as a grid that should
keep square cells, can add `heightFor: (width, props) => number`. The runtime
resizes the canvas with it, unless the post set `height` itself.
`grid-search.ts` shows it.

Keep the figure's layout independent of animation time. Reserve room for the
final labels and controls from the first frame. Non-looping figures keep the
replay button's space while it is hidden, so revealing it cannot rewrap the
caption or move the surrounding article. Looping figures have no replay slot.

The bare minimum of a kind looks like this:

```ts
import { defineFigure, ease, num, obj, progress, text, dot } from "../kit";

interface Props {
	workers: number;
}

export default defineFigure<Props>({
	duration: 6, // seconds, then it holds on the last frame
	loop: false, // true restarts after a pause, for steady-state motion
	height: 240,

	decode(raw) {
		const p = obj(raw, "props");
		return { workers: num(p.workers, "props.workers") };
	},

	draw(frame, props) {
		const { ctx, width, height, time, palette } = frame;
		const t = ease.out(progress(time, 0.5, 2)); // 0→1 between 0.5s and 2.5s
		// …paint the whole picture for this moment…
	},
});
```

### Rules

1. `draw` paints the entire frame for `frame.time` and keeps no state. Derive
   everything from `time`, using `progress(time, start, length)` to schedule
   each step. Never count frames or store values between calls. The runtime
   seeks to arbitrary times: the final frame for reduced motion, and any
   moment for screenshots.
2. Randomness comes from `random(seed)`, never `Math.random()`. The same
   moment must look the same every time.
3. Every colour comes from `frame.palette`. Do not write hex values. The figure
   then follows light and dark mode and any theme. Roles:
   - `marker`: the thing the reader should watch. Use it for one thing.
   - `inkStrong`, `inkMuted`, `inkFaint`: everything else, by importance.
   - `danger`: failure (dropped, timed out, errored). `warn`: degraded.
   - `rule`, `ruleFaint`: axes, grid, edges.
   - `paper`, `surface`: fills behind boxes and labels.
4. Lay out from `frame.width` and `frame.height`, never fixed pixel positions.
   The figure must work from 340px (phone) to 720px wide. Check
   `width < 520` and simplify for narrow screens.
5. Text is at least 11px. Use `text()` for plain text and `label()` for text
   that sits on a line, because `label()` draws a backing plate and moves
   left before it runs off the edge.
6. Draw in layers: grid and axes, then lines, then moving things, then labels
   and boxes. Anything drawn later covers what is under it.
7. One idea per figure, and one thing moving at a time. Reveal in order:
   structure first (0–0.6s), then motion, then the conclusion (a marker
   line, a number) at the end. Every part of the canvas has something in it
   from the start. A panel that stays empty until halfway looks broken.
8. `decode` reads every prop with the `obj`, `arr`, `num`, `str`, `nums`,
   `tone` and `maybe` helpers, and throws on anything unexpected. Give
   optional props a default here, not in `draw`.
9. Do not repeat the caption inside the canvas. The caption says what to
   watch; text in the canvas labels things (a node, an axis, a value).
10. If the figure claims that something happens, compute it; do not act it
    out. When a figure compares two cases ("tight spacing keeps the jam,
    wide spacing dissolves it"), both lanes run the same model with one
    input changed, and the difference the reader sees comes out of that
    model. Hand-tuned multipliers per lane (`growth: 1.12` here,
    `decay: 0.42` there) only show what the author expected, and the reader
    cannot tell the two apart. Write a small `simulate()` in plain
    arithmetic (a queue, a car-following rule, a retry loop), run it once in
    `decode`, and draw from its output, as `queue.ts` does. Then report
    the outcome as a number taken from the simulation.

## Checking a figure: look at it

Do not stop when the build passes. Look at the figure.

```bash
npm run figures:shot -- /posts/build/my-post/        # the post's URL path
```

You do not need to start a dev server, and you do not need to fix one that
will not start. The script uses this project's running one if it answers, and
otherwise starts a private one and stops it when done. If `astro dev status`
lists a server that does not answer, its lock file is stale; leave it, the
script is not affected. If the post fails to build, for example because a prop is wrong, the
script prints the build error and exits non-zero.

This writes PNGs to `.figures-shots/`: every canvas and `SvgFigure` on the page at 15%, 40%,
70% and 100% of its duration, in light and dark. Open them and check:

- [ ] `npm run check` passes. The deploy runs it and refuses to publish
      otherwise, and `astro check` catches things a screenshot cannot, such
      as `values[i]` possibly being `undefined`.
- [ ] Nothing overlaps: labels, lines, boxes, the edges of the canvas.
- [ ] The 15% and 40% frames show something already, not an empty box.
- [ ] The final frame says what the caption says.
- [ ] Dark mode is as readable as light.
- [ ] Phone width works: `FIGURES_WIDTH=390 npm run figures:shot -- …`
- [ ] Short moments such as a burst or a flash are visible. Pick the moments
      with `FIGURES_AT=0.42,0.45,0.48 npm run figures:shot -- …`

To use a particular server instead, set
`FIGURES_BASE=http://localhost:4400`.

The script also exits non-zero and prints the message if a figure threw in
the browser. Fix what you see, run it again, and look again.

Model regressions run with `npm test`. To check manual replay with reduced
motion and resizing held frames, start `astro dev --background`, then run
`npm run test:figures:browser`. It reads the running server's URL from
`.astro/dev.json`; `FIGURES_BASE` overrides it. These browser tests need
Playwright's Chromium, just like `figures:shot`.

State-machine inputs must be at least 0.55 seconds apart so each transition
can finish. Gantt schedules that exceed 10,000 events fail the build; use a
larger round-robin quantum or smaller job bursts to keep the trace bounded.

## How it fits together

- `src/components/Figure.tsx` checks props at build time and renders the
  canvas and caption. `Figure.astro` is a compatibility wrapper around it.
- `src/figures/element.ts` holds the shared props and validation boundary.
- `src/components/SvgFigure.tsx` frames a post-specific SVG with a caption
  and accessible description. It renders HTML/SVG at build time.
- `src/components/FigureExamples.tsx` renders a data-driven gallery of kinds.
- `src/components/figures/index.tsx` exposes all 44 typed data components.
- `src/content/posts/build/_figures/*.tsx` contains examples of post-specific
  compositions and SVG drawings. These do not register new kinds.
- `src/scripts/figures.ts` is the runtime: canvas sizing, the theme palette,
  play on scroll into view, pause when off screen, replay, reduced motion,
  and `?figure-at=` for stills. It is imported only on pages that have a
  figure.
- `src/figures/kit.ts` holds the types and drawing helpers that kinds use.
- `src/figures/kinds/*.ts` holds the kinds. Adding a file adds a kind; there is
  no list to update.
- `scripts/figures-shot.mjs` is the screenshot script behind
  `npm run figures:shot`.
