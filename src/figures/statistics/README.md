# Statistical figures

Thirty reusable kinds use the existing `<Figure>` runtime. The published guide
is `/posts/build/statistical-figures/`. Its reproducible
inputs live in `src/content/posts/build/_figures/statistics-data.ts`; change the data, not the drawing, to reuse a kind.

```mdx
import Figure from "#src/components/Figure.astro";

<Figure
  kind="boxplot"
  props={{ groups: [
    { label: "A", values: [1, 2, 2, 3, 4, 9] },
    { label: "B", values: [2, 3, 4, 4, 5, 6] },
  ] }}
  caption="A has an isolated high observation; B's central values are higher."
/>
```

All kinds accept `title?: string`. `<Figure>` supplies `caption`, screen-reader
`label`, optional fixed `height`, replay, theme colours, reduced motion and
responsive resizing. Every model is computed in `decode`; drawing is a pure
function of time, so screenshots and the reduced-motion final frame agree.
No statistical plotting dependency or network request is added to the page.

Every kind also has a typed named component in `src/components/figures`,
such as `Boxplot`, `ECDF` or `KaplanMeier`. The general API is available from
`src/components/Figure.tsx`. Import it inside
a post-specific TSX component, then import that component in MDX. For example,
`src/content/posts/build/_figures/LatencyComparison.tsx` shares one data set
between ECDF and boxplot. `FigureExamples.tsx` renders this gallery's repeated
example layout. Example data and prose stay outside the numerical models and
renderers. A unique drawing can instead compose `SvgFigure.tsx` with SVG; see
`_figures/NormalCoverage.tsx`. These examples need no client directive.

## Inputs

Notation below:

- `groups`: `{ label: string, values: number[] }[]`, 1–8 groups with 2–2000
  observations each. Values are finite and have magnitude at most 1e12.
- `points`: `{ x: number, y: number }[]`, 2–2000 finite pairs of the same
  magnitude range. Diagnostic and agreement plots require more observations.
- `estimates`: `{ label, estimate, low, high, weight? }[]`, 1–20 supplied
  intervals, with `low <= estimate <= high` and positive `weight` (default 1).
  These are supplied intervals, not confidence intervals inferred from widths.
- `data`: `{ score: number, label: 0 | 1 }[]`, 2–4000 scored observations.

| Kind | Required props | Optional props / interpretation |
| --- | --- | --- |
| `scatter` | `points` | `fit: boolean` (false), `xLabel`, `yLabel`. Fit is intercept + one-predictor OLS and needs 3 points with varying x. |
| `boxplot` | `groups` | `unit`. Tukey whiskers end at observations within 1.5 IQR, not at the fences. |
| `violin` | `groups` | `unit`, `bandwidth`. Gaussian KDE; every group's peak width is normalized separately. |
| `ecdf` | `groups` | `unit`. Exact right-continuous steps, including ties. |
| `qq` | `samples: number[]` | `reference: number[]` for two-sample Q–Q; otherwise a normal reference with `mean`, `sd` defaulting to sample estimates. |
| `interval` | `estimates` | `reference: number` (0), `xLabel`. Points and supplied intervals. |
| `kde` | `groups` | `unit`, positive `bandwidth`. Gaussian KDE with robust Silverman bandwidth by default. |
| `beeswarm` | `groups` | `unit`. Lateral packing never changes the value coordinate. Dense samples may overplot. |
| `raincloud` | `groups` | `unit`, `bandwidth`. Half violin, narrow box and individual observations. |
| `boxen` | `groups` | `unit`. Nested central 50%, 75%, 87.5%, … intervals, at most 5 levels; small samples use fewer levels. |
| `ridgeline` | `groups` | `unit`, `bandwidth`. Each density peak has the same height; height is not comparable density. |
| `pp` | `samples: number[]` | `reference`, `mean`, `sd` as for Q–Q. CDF values are evaluated at the union of observed values for two samples. |
| `hexbin` | `points` | `bins`: integer 4–30 (12). Axial hex binning in fixed normalized data space; counts do not change on resize. |
| `density-contour` | `points` (at least 3) | Positive `bandwidthX`, `bandwidthY`. Gaussian product KDE, marching squares; levels are 15/35/60/85% of peak density, not probability mass. |
| `pairplot` | `columns: string[]`, `rows: number[][]` | 2–5 unique columns, 3–500 observations; each row has one value per column. Diagonal: histograms. |
| `jointplot` | `points` | Marginal histograms share the corresponding scatter axes. |
| `forest` | `estimates` | `reference`, `xLabel`, supplied `pooled: {label,estimate,low,high}`. Square area scales with supplied weight; pooled interval is a diamond. |
| `funnel` | `studies: {estimate,se}[]` | 3–1000 studies; positive SE. `center` defaults to inverse-variance weighted mean. Guides: center ± 1.96 SE; SE increases downward. |
| `bland-altman` | `points` (at least 3) | x and y are paired measurements. Difference = y − x. Guides: mean difference ± 1.959964 sample SD, normal-approximation limits of agreement, not a mean CI. |
| `mosaic` | `rows: string[]`, `cols: string[]`, `counts: number[][]` | 2–8 categories per axis; nonnegative integer counts, no empty margins. Cell area ∝ count; colour shows sign/magnitude of Pearson residual under independence. |
| `residual` | `points` (at least 4) | Fits OLS; x is fitted value, y is raw residual. |
| `scale-location` | `points` (at least 4) | x is fitted value; y is √absolute internally standardized residual. Unit-leverage samples are rejected. |
| `influence` | `points` (at least 4) | Leverage × internally standardized residual. Point area scales with Cook's distance, subject to a minimum visible radius. Danger: Cook's D > 4/n, a heuristic. |
| `acf` | `values: number[]` (at least 4) | `lags`: 1–min(40, floor(n/2)−1), default min(16, maximum). Lag zero omitted. Constant series rejected. |
| `pacf` | `values: number[]` | Same lag limits; Yule–Walker MLE / Durbin–Levinson using biased ACF. |
| `lag` | `values: number[]` (at least 4) | `lag`: 1–n−2 (1). Current value against the lagged value, sharing domains. |
| `kaplan-meier` | `groups: {label, observations: {time,event:boolean}[]}[]` | 1–6 groups, 1–2000 observations each; time >= 0. `event: false` is right-censored. Greenwood log-log 95% bands. |
| `roc` | `data` | Both classes required. Real-valued scores allowed. Tied scores advance together; trapezoidal ROC AUC. |
| `precision-recall` | `data` | Both classes required; whole tied-score groups. Staircase area is average precision, not trapezoidal PR AUC. Baseline = prevalence. |
| `calibration` | `data` with scores in [0,1] | `bins`: integer 2–20 (10). Equal-width bins; empty bins omitted, score 1 included. Point sizes reflect counts; Brier score reported. |

## Statistical conventions

- Quantiles use linear interpolation (R type 7 / NumPy's linear default).
  Sample variance divides by n−1. KDE has unbounded Gaussian support; it does
  not correct boundaries of positive or bounded variables. Set a sensible
  bandwidth when a sample's scale or shape needs it.
- A fitted normal Q–Q/P–P reference estimates its parameters from the sample
  unless explicitly supplied. Its identity line is a visual reference, not a
  hypothesis test or a confidence band. Constant samples need an explicit SD
  or a two-sample reference.
- OLS diagnostics use two fitted parameters (intercept and slope), residual
  MSE = SSE/(n−2), and leverage = 1/n + (x−mean(x))²/Sxx. A perfect fit has zero
  residuals and zero displayed Cook distances. These plots do not fit multiple
  predictors or a generalized linear model.
- ACF uses the same total centered sum of squares at every lag (biased / MLE
  convention). ACF/PACF dashed guides are ±1.959964/√n, an approximate pointwise
  white-noise reference, not a general confidence band or a multiple-lag test.
- Survival risk sets remove events before censoring at a tied time. Censoring
  never creates a survival drop. Bands use log-log Greenwood intervals with
  the endpoint conventions 0→[0,0] and 1→[1,1]. There is no extrapolation past a
  group's last follow-up and no support for left truncation or competing risks.
- Examples state their interval assumptions. In particular, a forest plot's
  pooled interval and weights come from its author; a funnel's asymmetry does
  not establish publication bias; Bland–Altman limits are not mean CIs.

Primary references: [NIST EDA](https://www.itl.nist.gov/div898/handbook/eda/section3/eda33.htm),
[seaborn KDE](https://seaborn.pydata.org/generated/seaborn.kdeplot.html),
[statsmodels PACF](https://www.statsmodels.org/stable/generated/statsmodels.tsa.stattools.pacf_yw.html),
[scikit-learn ROC](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html),
[precision–recall](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_curve.html),
[lifelines Kaplan–Meier](https://lifelines.readthedocs.io/en/latest/fitters/univariate/KaplanMeierFitter.html).

## Verify

`npm run check` checks types, lint, schemas and numerical regressions. Browser
tests (`npm run test:figures:browser`, with a running dev server) exercise all
30 kinds and their resize/theme behaviour. Capture the full gallery with:

```bash
npm run figures:shot -- /posts/build/statistical-figures/
FIGURES_WIDTH=390 FIGURES_OUT=.figures-shots-statistics-phone npm run figures:shot -- /posts/build/statistical-figures/
```

Look at the PNGs. Numeric tests cannot tell whether a label overlaps another.
