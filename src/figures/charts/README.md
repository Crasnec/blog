# Basic charts

Use typed `Bar`, `Pie` and `Area` from `components/figures`, or the equivalent
`Figure` kinds `bar`, `pie` and `area`. The example post is
`/posts/build/basic-charts/`. All inputs are serializable and validated at
build time. No additional library or client hydration is required.

## Shared options

`title`, `unit`, `showLegend` (true) and `showValues` (true) are available on
all three kinds. Captions, accessible labels and optional fixed heights use
the existing Figure props. Prefer automatic height for responsive layouts.
Series and slices accept an optional semantic `tone` from the shared palette.
The first entry defaults to `marker`, the rest to `ink`. Patterned fills
supplement color for additional entries.

Every basic chart supplies an HTML table through the optional `FigureKind.table`
hook. Tables show original values and full labels. They stay available with
JavaScript disabled. Units describe the source values, even when the plotted
axis shows percentages. Pie tables also report shares, rounded to six
significant digits. Canvas labels use compact rounding; they never replace
the source data.

All numbers must be finite, either zero or have magnitude in [1e-12, 1e12].
Labels contain 1–120 characters; category, series and slice labels are distinct
within their own list. Unknown properties and invalid optional values fail
validation rather than silently using a default.

## Bar

Required: `categories: string[]` (1–24) and `series: { label, values, tone? }[]`
(1–6). Each series has one value per category.

- `orientation`: `vertical` (default) or `horizontal`.
- `mode`: `grouped` (default), `stacked` or `percent`.
- `categoryLabel`, `valueLabel`: optional axis descriptions.

The numeric axis always includes zero and all plotted values. Grouped bars
start independently at zero. Stacks accumulate positive and negative values
separately. Percentage mode rejects negatives and normalizes each category;
zero-total categories have no defined shares and remain empty. Original zeros
remain in the table. Exact percentages can have small floating-point rounding
differences.

Choose horizontal bars for many categories or long labels. Labels truncate
to their slots, and numeric labels are omitted when they do not fit. All
data remains in the table. Height depends on category/series count for
horizontal bars, reserving space before animation starts.

## Pie

Required: `slices: { label, value, tone? }[]` (1–8). Values are nonnegative
and their total must be positive.

- `variant`: `pie` (default) or `donut`.
- `totalLabel`: optional text under the donut's total.

Slice angles follow their share of the total, clockwise from twelve o'clock.
Zero slices have zero angle but retain their legend and table entries.
The legend moves below the circle on narrow screens. `showValues` controls
legend values/shares and the donut's total. Small differences are usually
easier to compare with bars. Rounded percentages may not add to exactly 100.

## Area

Required: `x: number[]` (2–500, strictly increasing) and
`series: { label, values, tone? }[]` (1–6, one value per x).

- `mode`: `overlay` (default), `stacked` or `percent`.
- `xLabel`, `yLabel`: optional axis descriptions.

X positions preserve actual distances, including unequal sample intervals.
Straight lines interpolate between samples. Overlay areas may be signed;
stacked and percentage areas require nonnegative values. Percentage mode
normalizes each sample before interpolation. A zero-total sample has zero
height, with neighboring samples connected to it: intermediate filled areas
are interpolated geometry, not independently measured proportions.

The y-axis includes zero. Legend values show the final sample, in original
units or percent according to mode; use `showValues: false` to hide them.
Do not interpret an area integral as a total without considering the x unit
and whether interpolation is appropriate.

## Implementation and checks

`model.ts` owns decoding, stack arithmetic, domains and pie angles. `draw.ts`
owns shared layout, patterns and axes. Kind files draw from that model using
the existing pure-time runtime; no per-frame data processing or listeners are
added. `test/basic-charts.test.ts` checks signed stacks, percentage conversion,
zero totals, area coordinates, invalid inputs and the original-value tables.
The browser suite checks responsive drawings, static tables and replay.

Inspect screenshots in light and dark themes at phone and desktop widths.
Use the existing Figure screenshot workflow described in the parent README.
