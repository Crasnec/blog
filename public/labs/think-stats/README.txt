Think Stats, 3rd edition — Korean translations and browser labs, chapters 1–8

Author: Allen B. Downey. Copyright 2024.
Source: https://github.com/AllenDowney/ThinkStats/tree/30ecbdcf05723f1190cae2aeaff5848f59f8ca26
Chapters: nb/chap01.ipynb through nb/chap08.ipynb.
Published outputs: matching notebooks under soln/.

chap01-ko.ipynb translates all 57 markdown cells and preserves all 42 code
cells, their order, and cell IDs. Code cells retain their original setup,
including downloads from the author's v3 branch. Those upstream URLs may
change with that branch. The translation was made from the commit above.
Text and translation: CC BY-NC-SA 4.0.
https://creativecommons.org/licenses/by-nc-sa/4.0/
Code: MIT, see LICENSE-code.txt.

The additional translations preserve every markdown cell, code cell, cell
ID, and cell order:
- chap02-ko.ipynb: 63 translated markdown cells, 55 unchanged code cells.
- chap03-ko.ipynb: 61 translated markdown cells, 60 unchanged code cells.
- chap04-ko.ipynb: 75 translated markdown cells, 86 unchanged code cells.
- chap05-ko.ipynb: 86 translated markdown cells, 98 unchanged code cells.
- chap06-ko.ipynb: 84 translated markdown cells, 85 unchanged code cells.
- chap07-ko.ipynb: 73 translated markdown cells, 71 unchanged code cells.
- chap08-ko.ipynb: 82 translated markdown cells, 90 unchanged code cells.
Notebook metadata records source hashes and translation changes. Brief
translator notes clarify source inconsistencies: integer representatives
of class-size intervals, an excluded range endpoint, a helper function
name, the ordering assumed by the percentile example, the age variable's
meaning, and the continuous-distribution assumption in the rank example.
The skewness explanation follows the displayed code's mean of cubed
deviations. Chapters 5–7 also clarify reversed hit/attempt counts, the
direction of the trimmed mean change, the finite-game simulation's
approximation to exponential waiting times, finite-interval rounding to
one, the linear prediction interpretation of correlation, an SAT/PIAT
label mismatch, and different tie-handling rules for rank correlation.
The duplicated last exercise number 7.4 is labelled 7.5 in the translation.
Exercise solutions are not added. Outputs of the original, self-contained
exercise demonstrations are included without supplying the missing answers.

The 69 notebook-output PNG files in figures/ are copied from the published notebook outputs
without image edits. They are covered by the book's CC BY-NC-SA 4.0 text
license; Korean alternative text explains each plot. figures/sources.json
records their source cell IDs and SHA-256 hashes. Random-sample figures
show the author's published run; a new execution produces a different
sample. Student-notebook code remains unchanged even where the prose needs
a translator's clarification. The additional distribution-framework PNG
comes from figs/distribution_framework.png at the same commit; it has a
separate source_asset entry in the figure manifest.

chap01-browser.py adapts the chapter's reading, cleaning and summary code
for the blog's existing CodePlayground: same-origin pyfetch replaces network
setup; a DataFrame copy consolidates pandas blocks before adding a derived
column; print statements make notebook expressions visible in a script.
It does not include thinkstats.py (a separately licensed helper, unused by
this chapter's calculations). Exercise solutions are not included.

chap02-browser.py adapts the frequency tables and pregnancy-length effect
size example. The input selects one of four variables.
chap03-browser.py adapts the class-size paradox. The input changes the
number of classes with 5–9 students; blank input preserves the book's
original example. The debiased mean recovers the actual class-based mean.
chap04-browser.py adapts the birth-weight CDF comparison and inverse-CDF
sampling. Inputs select a weight and sample size. Sampling is intentionally
unseeded to demonstrate variation between runs.
All three use the existing CodePlayground and its asynchronous read_input
function. Every run starts a new worker. The data preparation for chapters
2 and 4 uses chapter 1's MIT-licensed reader and cleaning statements, and
the grouping queries shown in the MIT-licensed chapter notebooks. It does
not bundle or copy code from nsfg.py, relay.py, or thinkstats.py, whose
headers specify GPLv3. The downloadable notebooks still download these
upstream helper modules, preserving their original setup and notices.
The browser adapters filter only the two Matplotlib 3.10 deprecations about
Agg's internal x/y text-pixel coordinate conversion in the current Pyodide
build. Other warnings remain visible. The original notebook code has no
warning filters.

chap05-browser.py adapts the binomial model and simulation. It accepts the
number of targets and success probability, preserves the seed and the
preliminary draws for the book's default example, and evaluates the complete
PMF on 0 through n instead of displaying only its upper range.
chap06-browser.py uses the chapter 1 reader and cleaning statements to
compare normal density, Gaussian KDE, numerical integration, CDF differences,
and an empirical interval proportion. The inputs select an interval and KDE
bandwidth factor. The empirical proportion explicitly includes both
endpoints; point masses from rounded measurements can make its endpoint
convention matter, unlike the continuous normal model.
chap07-browser.py reads the NLSY excerpt, selects valid pairs, and computes
Pearson and average-tie Spearman correlations. The inputs select a response
variable and visual jitter. Jitter affects only the scatter plot; correlation
and decile summaries use the original observations. The scatter uses a fixed
seed and the decile plot drops duplicate quantile edges if needed.
These adaptations use NumPy, pandas, SciPy, Matplotlib, empiricaldist, and
statadict already supported by CodePlayground. Full notebook setup still
downloads the original HDF, HTML, and BRFSS sources where used; native
verification also used PyTables, lxml, and SymPy. The large source files are
not bundled with these short browser exercises.

NLSY data: NLSY97, a longitudinal survey of US youth born in 1980–1984.
The 8,984-row, 34-column excerpt is copied byte-for-byte from the book's
data/nlsy97-extract.csv.gz at the pinned commit. Chapter 7 states that the
author obtained permission to redistribute this excerpt. It is survey data,
separate from the book's code license; preserve the original attribution.
Source notebook: https://allendowney.github.io/ThinkStats/chap07.html
Other chapter examples use the author's preserved 2020 Olympic skeet table,
2023–2024 NHL regulation-time goal data, 2008 BRFSS records, and the
Brisbane birth-time dataset described in chapter 6. Their provenance is
retained in the corresponding translations and notebooks.

chap08-browser.py fits a normal model to the 68 observed Chinstrap penguin
weights, then simulates 1,001 samples of a user-selected size. The default
size is 68. The user can change the nominal confidence level, while the seed
is fixed at 1 for this standalone lab. Both figures use the same x-axis
range to compare individual-weight variation and sampling variation of the
mean. Changing the simulated size is a hypothetical future survey, not a
change to the 68 observed data points. The percentile interval is an
approximation under the fitted independent normal model.
Chapter 8 preserves the author's philosophical view on confidence-interval
interpretation and adds a separate translator note explaining frequentist
coverage, with a link to NIST. Other notes distinguish normal-model
unbiasedness from a universal property of the median, and the hot-hand
estimator's finite-sample bias from the true conditional success probability.

Penguin data: penguins_raw.csv, copied byte-for-byte from the exact commit
specified by the book:
https://github.com/allisonhorst/palmerpenguins/blob/c19a904462482430170bfe2c718775ddb7dbb885/inst/extdata/penguins_raw.csv
The source repository's README identifies the data license as CC0:
https://github.com/allisonhorst/palmerpenguins/blob/c19a904462482430170bfe2c718775ddb7dbb885/README.md#license
Attribution: Horst AM, Hill AP, Gorman KB (2020), palmerpenguins,
https://doi.org/10.5281/zenodo.3960218; research data collected by
Gorman KB, Williams TD, Fraser WR (2014),
https://doi.org/10.1371/journal.pone.0090081.
The CSV has 344 rows; the book removes two missing body masses and then
selects the 68 Chinstrap penguins. The chapter's opening account refers to
342 measured penguins.

Data: NSFG Cycle 6 (January 2002–March 2003), CDC/NCHS.
https://www.cdc.gov/nchs/nsfg/nsfg_cycle6.htm
Files copied byte-for-byte from the book repository's data/ at the commit
above. They contain 13,593 pregnancy records and 243 columns.

Data use terms, translated in the post, apply to these files:
- Use only for statistical reporting and analysis.
- Do not attempt to identify any person or establishment.
- Do not link to individually identifiable data from NCHS or other sources.
- Do not evaluate disclosure protection or research re-identification.
Full terms and source: https://www.cdc.gov/nchs/data_access/ftp_dua.htm

SHA-256 of the upstream artifacts:
feaec091f260c08dd7b137557ed7132440030a12992026501ed5769640ba0ceb  2002FemPreg.dct
59b601146451be3f5591e3a3392105e20aea8b6a9d8d6638641d02bb81ef8c03  2002FemPreg.dat.gz
2a20387412aaeb39cd264b86ce3ecab23bcda30bc8c796c8d4120b05b20da23c  nlsy97-extract.csv.gz
03274d1fab654ca08d388faa6c192a391f03a2ae864e2c88b0f0716d9632b15b  figures/distribution-framework-original.png
144f623143c9360fd77322a4f86acb06dc198814dbd2669724c63e6457b907bd  penguins_raw.csv

Inline browser exercises
------------------------
The posts use three independent CodePlayground exercises per chapter.
chapNN-browser.py is the real-data or larger model exercise; the additional
chapNN-<topic>.py files are short, self-contained exercises placed alongside
the relevant explanation. They use read_input() for adjustable values and
explicit print()/plt.show() for output. Each execution starts a new worker.
The exercises adapt the book's ideas and MIT example code; they do not aim
for cell-for-cell correspondence. Original translated notebooks remain
available for readers who want the source notebook sequence.

Figure components reuse the existing boxplot, distribution, heatmap, ecdf,
line, scatter, kde, and interval kinds. Author-side data and provenance live
in src/content/posts/statistics/_figures/. Input changes update the plots in
the playground's result; nearby fixed figures are reference examples, not
linked controls. No additional statistics UI/runtime or GPL helper module
is bundled.
