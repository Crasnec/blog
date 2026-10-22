# Think Stats figures

The posts reuse `Figure.astro` and its existing kinds. There is no separate
statistics renderer or client application in this directory.

`plots.json` contains serializable author data. Keys beginning with `chap`
identify chapter, zero-based notebook cell index, output index, and (for
scatter panels) axis index at ThinkStats commit
`30ecbdcf05723f1190cae2aeaff5848f59f8ca26`.

- Line arrays were extracted by executing the corresponding source cells.
  Every line uses a uniformly spaced x grid, as required by the existing
  line figure. Axis labels describe that grid. Vertical mean reference lines
  in chapter 8 use Figure notes instead of being treated as density curves.
- The chapter 6 normal/KDE comparison evaluates both functions on the KDE's
  grid (0.125–15.4375 lb); the original drew them on different uniform grids.
- Scatter arrays contain every point plotted by the source. No observation
  is dropped to fit the component. Each multi-panel source image becomes
  separate, full-width scatter figures, with actual sample correlations in
  their titles. This keeps them readable on phones.
- Named toy examples enumerate all observations or evaluate the stated formula.
  The outlier figure evaluates mean([1, 2, 2, 3, x]) and its median
  for 201 equally spaced values of x from 5 through 100. The class-size heatmap uses
  the chapter's exact counts and representative class sizes. Its rows each
  sum to one; no sample sizes are inferred from colour.
- `coverage` uses intervals 21–28 produced by
  `chap08-coverage.py` with its default input. It assumes a known population
  SD, unlike the separate fitted-model resampling lab.
- `bandwidth` explicitly supplies the kernel SD, 0.5, so Figure's KDE and the
  SciPy exercise use the same smoothing convention.

Source-derived figures and their adaptations retain the book's
CC BY-NC-SA 4.0 attribution. Complex original PNG outputs remain alongside
these component-based figures. The articles distinguish original cells from
standalone browser adaptations; each standalone lab starts a fresh Python worker. Linked body cells share a
chapter namespace and render their current plots in the cell output.

Chapters 9–14
-------------
chapters-09-14.json contains fixed reference inputs for existing Figure
kinds, with no new renderer. Named keys are generated from the default
standalone labs. They contain every observation used by those labs: all
151 Adelie pairs for OLS, all 1,001 bootstrap slopes or simulated means,
and all 50 administratively censored bulb lifetimes. No silent thinning
is used to fit component limits.

The coin PMF includes deviation values 0–40 for readability; its lab computes
the exact tail on all 126 possible deviations. Simple source KDE inputs
(chap09/chap10 keys) come from re-executed pinned source cells on uniform
x grids. Vertical reference lines become nearest-grid notes. The chapter 11
logistic curves come from rerunning the corrected sex-encoding code; their
x grids are preserved and all model lines share those grids.

Chapter 12 lines use equally spaced monthly observation indices, labelled
with their start/end calendar months, not elapsed-day interpolation. The
forecast and ARIMA reference figures use only the training interval for
fitting and show all 60 held-out months. Interval limits are explicitly
computed in Python. The ACF kind uses the library's biased convention;
its white-noise guides are only approximate pointwise references.

The survival figure uses original durations administratively censored at
1,700 hours and the existing kind's event-before-censoring tie convention
and pointwise 95% log-log Greenwood intervals. The marriage comparison is
evaluated monthly over ages 15–35, joined with straight lines, with no
extrapolation after follow-up and no survey-uncertainty band. Its lab shows
the actual event-time steps instead. Remaining-duration means use T>=t.

Chapter 14 source multi-panel Q–Q plots become separate full-width figures.
Their samples are the same 1,001 sums captured during source execution, but
the existing Q–Q kind expresses the fitted normal reference in sample units
and uses its standard quantile convention. Captions disclose this change.
The separate CLT lab reference uses means, not sums, and independent
np.random.default_rng(1) experiments for n=1, 10, 100. Interval inputs use
sample variance (ddof=1) and distinguish normal, Welch and bootstrap methods.

Source-derived inputs and adapted figures retain CC BY-NC-SA 4.0 attribution.

The source chapter 12 four-panel additive and multiplicative decompositions
are recomputed from the same CSV and seasonal_decompose arguments, then
split into four full-width line figures. Uncomputable trend/residual edge
months are dropped, with each panel's actual month endpoints labelled.
The manual decomposition's earlier 12-month rolling mean remains a trailing
mean; seasonal_decompose uses its centered filter. These are distinct steps.
