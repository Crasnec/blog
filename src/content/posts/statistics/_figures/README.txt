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
standalone browser adaptations; each execution starts a fresh Python worker.
