Think Stats, 3rd edition — Korean translations and browser labs, chapters 1–14

Author: Allen B. Downey. Copyright 2024.
Source: https://github.com/AllenDowney/ThinkStats/tree/30ecbdcf05723f1190cae2aeaff5848f59f8ca26
Chapters: nb/chap01.ipynb through nb/chap14.ipynb.
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

The notebook-output PNG files in figures/ are copied from the published notebook outputs
without image edits. They are covered by the book's CC BY-NC-SA 4.0 text
license; Korean alternative text explains each plot. figures/sources.json
records their source cell IDs and SHA-256 hashes. Random-sample figures
show the author's published run; a new execution produces a different
sample. For chapters 1–10 and 12–14, student-notebook code remains unchanged
even where the prose needs a translator's clarification. Chapter 11 has
the two code corrections described below. The additional distribution-framework PNG
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
Alongside the linked body cells, the posts retain three independent
CodePlayground exercises per chapter,
except chapter 14, which has four.
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
linked controls. No additional statistics UI or runtime is bundled. The linked body notebooks
now include the separately licensed source helpers described below.

Remaining chapters: 9–14
------------------------
Every markdown cell is translated. Cell IDs and order are retained; missing
exercise solutions remain missing. All code cells are unchanged except the
two sex-encoding cells in chapter 11. The original download/setup code still
refers to the author's v3 branch. The MDX omits setup and empty solution
stubs, converts tables to accessible Markdown tables, and adapts Jupyter's
add_method_to magic into function definitions followed by class assignment.

Chapter 11 corrections: code cells 109 and 129 first restrict Sex to MALE or
FEMALE. The original Boolean encoding incorrectly labelled unknown sex as
female. Corrected logistic models use 146 Adelie or 119 Gentoo observations.
The post's downstream outputs and curves were recomputed from that change;
there are no copied original PNGs from the affected logistic section.
Other translator notes clarify exchangeability, finite Monte Carlo tails,
in-sample R², model adjustment, dependent observations, forecast intervals,
independent censoring, complex survey limitations and the CLT assumptions.
Chapter 14 exercise 14.3 corrects the 5-by-2 independence table's degrees of
freedom to (5-1)(2-1)=4, and points to chi2_contingency. No answer is supplied.

The 19 additional standalone labs use the existing CodePlayground runtime:
- Chapter 9: exact/Monte Carlo coin tails, NSFG label permutations with
  mean or SD differences, dice chi-square or absolute-deviation statistics.
- Chapter 10: Adelie OLS, a five-point intercept/MSE experiment, paired-row
  bootstrap slope SE and percentile intervals.
- Chapter 11: multi-predictor OLS, NSFG age adjustment, corrected logistic
  sex modelling. Unknown sex is excluded before binary encoding.
- Chapter 12: additive/multiplicative seasonal decomposition, strictly
  chronological trend/seasonal forecasting, SARIMA(p,0,0)(0,1,0,12).
  The browser SARIMA is smaller than the source's sparse ARMA model.
- Chapter 13: Kaplan–Meier with user-set administrative censoring, weighted
  NSFG marriage cohorts, weighted conditional remaining pregnancy duration.
  Browser KM is calculated directly without installing or bundling lifelines.
  Bulb frequency counts explicitly use np.intp for np.repeat on wasm32;
  this preserves the observations while avoiding implicit int64 narrowing.
  The marriage lab resamples separately by survey cycle; it omits Greenwood
  bands because those are not complex-survey uncertainty intervals. Remaining
  duration uses direct survey-weighted means instead of weighted resampling.
- Chapter 14: fitted-normal Q–Q, normal/Welch/bootstrap mean-difference
  intervals, CLT simulations including infinite-moment and dependent cases,
  and simulated versus asymptotic dice chi-square tails.

Native verification executes all main source cells through the first
exercise section, then runs each browser lab with default and changed input.
The 38 lab cases are also exercised in the actual browser Python environment.
Figures are fixed reference examples; changes to a playground input update
its result plots, not the surrounding reference Figures.

Additional data (byte-for-byte copies at the pinned book commit):
- Net_generation_for_all_sectors.csv: EIA monthly electricity generation,
  downloaded by the author on September 17, 2024, values through June 2024.
  https://www.eia.gov/electricity/data/browser/
- marriage_nsfg_female.csv.gz: the author's 70,183-row, 34-column combined
  NSFG female respondent extract; the original CDC/NCHS data-use terms above
  apply. Chapter 13 preserves the survey-cycle weighting discussion.
- lamps.csv: 50 incandescent-bulb lifetimes aggregated in h/f columns, from
  the exact gist revision cited by chapter 13:
  https://gist.github.com/epogrebnyak/7933e16c0ad215742c4c104be4fbdeb1/raw/c932bc5b6aa6317770c4cbf43eb591511fec08f9/lamps.csv
  Its original provenance is
  preserved in that translated chapter; the gist is a data source, not code.

Additional upstream SHA-256 hashes:
b280af0df4db659593cfb62949d61d41622069bcbacf2f45a0218c108276b94a  nb/chap09.ipynb
606cfd9d7aa775b0745f68c4c19113bd4bb4e07fbf21bb688bd7c4c13c753595  soln/chap09.ipynb
4d72140f7c6caa8e8e4fdda66fdb8da55f57bafe46b96f7a6fd43c79adb4c7dd  nb/chap10.ipynb
82b74576b9cecdde0da57808b645e5df1786e8d0168e980cc251290e3ac97b4d  soln/chap10.ipynb
7dcf6b506f489f2f4b13cb0ac67314667b146928ff45fc6e89d2e0964fa2462e  nb/chap11.ipynb
68543ddeb8863370e709b8d19a7ff426a16b891fbf27d16893ac976a1bb9f2c2  soln/chap11.ipynb
37c6524b279ad64045922ed625ef8467e91d0835b0d17ddba56824a28d22bdcd  nb/chap12.ipynb
3871c067232fb66fac797d95e4d4d2e377cfa9405e0287f124e8771d505a20b5  soln/chap12.ipynb
708e503e54f8b3a7d3c0d865e01059605c19f07a139fa0a7942314166dd45a56  nb/chap13.ipynb
c2766210f0cb2d55a8fc824d50cbd838de0ea0cd82f8cc503669832295e45c58  soln/chap13.ipynb
7a2d9492dde0783229ee7d62908713700935143409203a77efff1016376f0999  nb/chap14.ipynb
2dd46ea95f9a0bebc911642ade6d99753eecf418930d0413d23c6671d26fb95b  soln/chap14.ipynb
c38d9a07552cab99b4c2b8faced8b5b15311bcfaac679882b42884b56b9fc5e3  Net_generation_for_all_sectors.csv
d8c4987ddc2235a068c2751cea1f40b4b8373817137f9a666804dd9120ef3bf0  marriage_nsfg_female.csv.gz
cf167e6a50d90ab734f3961fd33dad4ab83364d04d976229dc921b24a1c11ab5  lamps.csv

Executable body notebooks
------------------------
The body code in chapters 1–14 is now linked into one persistent Python
environment per chapter. Standalone "direct execution" labs remain isolated.
The browser uses the same CodePlayground editor, Python worker, approved
package loader, input channel and bounded PNG output. It also displays a
cell's last expression, preserves state across reruns, numbers executions,
stops Run all at errors, marks later results stale and exports edited code.
Run all excludes exercise cells. Restart/Stop clears the shared environment
while preserving edits and the labelled reference results. Reference Figures
remain fixed; generated cell plots reflect the current executed source.

The per-cell source lives under src/content/posts/statistics/_notebooks/.
Every chapter begins with an editable same-origin preparation cell. It loads
pinned upstream helper modules from upstream/, which now contains unmodified
thinkstats.py, nsfg.py and relay.py with their original GNU GPLv3 notices,
the complete COPYING text and a SHA-256/source manifest. These modules are
separately licensed; the MIT notice for notebook/adaptation code does not
replace their license. The standalone labs still do not import those helpers.
The original downloadable Korean notebooks keep their existing code/setup.

Additional approved Pyodide packages lxml 6.1.3 and SymPy 1.14.0 (plus mpmath)
are pinned by the existing 314.0.7 runtime catalog. Package loading remains a
closed, integrity-checked graph. No general-purpose PyPI installer is enabled.

Browser-specific source changes:
- All NSFG pregnancy/respondent files and small original datasets are served
  from this site; the preparation cell downloads them once per environment.
- nhl-goals.json retains all 1,312 HDF game keys in their original order and
  every original goal time. Body cells use read_game() instead of PyTables.
- brfss-2008.csv.gz retains all 414,509 rows and six cleaned variables returned
  by the pinned read_brfss function. No observations are sampled or removed.
  CSV float round-trip equality with the original reader is verified.
  notebook_support.read_brfss reads this extracted frame rather than reparsing
  the large fixed-width source in the browser.
- Chapter 13's body uses notebook_support.KaplanMeierCurve in the Lifelines
  comparison section. It computes the same risk-set product, zero-time start,
  survival_function_ values and pointwise log-log Greenwood bands. The prose
  names this adaptation. It is not presented as an installed lifelines module.
- The earlier plain-Python replacement for chapter 14's Jupyter class-method
  magic remains executable. No source-replay trick implements state or input.

notebook-data-sources.json records source/output hashes and transformations
for the two extracted datasets. The remaining added files are byte-for-byte
copies of the chapter's original data, including NSFG female respondents,
the road-race result page, the preserved Olympic table, Brisbane birth times,
temperature records and the historic mortality table. Original attribution
and data-use terms in the translated chapters continue to apply.

Notebook code export includes attribution and the MIT notice. Source and
reference outputs are not silently labelled as executed. Book reference
outputs stay readable before execution; each actual run replaces its own
reference output, including original PNGs. Safe textual display of IPython
HTML avoids injecting styles, scripts, arbitrary HTML or widget code.
