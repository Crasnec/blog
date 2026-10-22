# Browser code playgrounds

Import `src/components/CodePlayground.astro` in MDX. The component renders the
initial source on the server; CodeMirror and syntax highlighting load only on
pages containing a playground. Execution starts only when the reader runs it.

```mdx
import CodePlayground from "../../../components/CodePlayground.astro";

<CodePlayground language="python" title="Mean" code={`from statistics import mean
print(mean([2, 4, 6]))`} />
```

Props:

- `code`: initial source, at most 100,000 characters.
- `language`: highlighting language and displayed name; defaults to `javascript`.
  JavaScript/TypeScript/Python and aliases `js`/`ts`/`py` have built-in grammars.
- `runtime`: `javascript`, `typescript`, `python` or `false`. Inferred from
  `language` by default; other languages get editing without execution. A
  custom grammar can highlight code while an explicit runtime executes it.
- `title`: accessible editor name and toolbar title; defaults to `language`.
- `grammars`: `{filename, content}[]`, first entry is the main TextMate grammar.
  JSON and XML/plist are accepted. Include dependent grammars in the same
  array, with unique `scopeName` values. At most 16 files totalling 1 MB.
  Authors specify these in MDX; readers cannot upload or replace them.
  Invalid grammar syntax or duplicate scopes fail the page build.
- `timeout`: execution limit in milliseconds, from 100 to 60,000; default 10,000.
  Loading the runtime and libraries has a separate 180-second limit. Stop
  works while loading.
- `pythonPackages`: optional array of approved package names to preload for
  dynamic imports. Ordinary imports are detected automatically. Names must be
  unique and require the Python runtime.

For a custom grammar, import it with Vite's `?raw` suffix and pass its text.
See `src/content/posts/build/browser-code.mdx` for all three runtimes and a
two-file TextMate grammar using an external `include`. The first supplied grammar
is the entry point; include dependent grammars in the same author-controlled
array. A grammar stays fixed when readers edit, reset or execute code.
Highlighting and execution are independent. There are no grammar upload or
replacement controls in the reader interface.

TextMate tokenization uses Shiki's Oniguruma WASM engine in its own Worker,
including repository rules, begin/end state across lines, captures and external
scope includes when their grammars are supplied. Unknown scopes use the base
text colour. Colours use CSS variables, so changing the site's theme does not
discard editor contents, selection or undo history. A 15-second highlighting
deadline terminates a stalled grammar worker; the code remains editable.

Without a notebook ID, every execution starts a fresh Worker and terminates it on completion, Stop,
timeout or page navigation. JavaScript and transpiled TypeScript execute as
ECMAScript modules, supporting top-level `await`. Use `console.log`, `info`,
`debug`, `warn` or `error` for output. TypeScript uses the official compiler's
`transpileModule` with syntax diagnostics; it does not perform type checking.
Workers have browser APIs rather than Node.js APIs or access to the page DOM.
There is no npm resolution, bundling of user imports or automatic installation.
Browser-supported absolute URL imports follow the browser's normal rules.
Worker isolation prevents page UI blocking; it is not a security boundary for
running hostile code with access to browser Worker APIs.

## Python libraries and plots

Python provides its standard library and eleven approved packages:

| Import | Pinned version | Distribution |
| --- | --- | --- |
| `numpy` | 2.4.6 | Pyodide 314.0.7 |
| `pandas` | 3.0.2 | Pyodide 314.0.7 |
| `scipy` | 1.18.0 | Pyodide 314.0.7 |
| `matplotlib` | 3.10.8 | Pyodide 314.0.7 |
| `seaborn` | 0.13.2 | Official pure-Python PyPI wheel |
| `empiricaldist` | 0.10.0 | Official pure-Python PyPI wheel |
| `statadict` | 1.1.0 | Official pure-Python PyPI wheel |
| `statsmodels` | 0.14.6 | Pyodide 314.0.7 |
| `IPython` | 9.12.0 | Pyodide 314.0.7 |
| `lxml` | 6.1.3 | Pyodide 314.0.7 |
| `sympy` | 1.14.0 | Pyodide 314.0.7 |

The approved roots are defined in `python-libraries.json`. The versioned npm
runtime's lockfile fixes native wheel versions, dependency metadata and
SHA-256 digests. `python-wheels.json` pins official PyPI wheels for Seaborn,
empiricaldist and statadict, which are absent from that catalog. Their native
dependencies come from Pyodide. Dependency keys use normalized Python package
names, including IPython's `prompt_toolkit` dependency. The resulting closed
graph contains thirty-three wheels; readers fetch only those required by their code.
No new npm dependencies are needed.

At development-server startup and build time, `python-packages.mjs` downloads
approved wheels into the ignored `.cache/python/<version>/` directory. Cached
and downloaded files must pass SHA-256 verification. Downloads use fixed
official distribution URLs, bounded concurrency and a timeout, with atomic
cache writes. `pyodide-assets.mjs` serves and copies the five runtime files,
approved wheels and a reduced lockfile containing only that dependency graph.
Browsers load same-origin files with Pyodide integrity checks enabled; there
is no browser CDN fallback or general-purpose package installer. A warm cache
allows subsequent builds without downloading wheels again.

Before executing source, `pyodide.code.find_imports` inspects its imports
without running it. Only approved roots are passed to `loadPackage`; the
reduced lockfile determines their dependencies. `from IPython.display import HTML` resolves to Pyodide's lowercase `ipython` package key. Standard-library examples
do not download scientific wheels. For a dynamic import, declare it explicitly:

```mdx
<CodePlayground language="python" pythonPackages={["numpy"]}
  code={`np = __import__("numpy")
print(np.arange(4))`} />
```

Matplotlib uses its non-interactive Agg backend in the Worker. `plt.show()`
serializes open figures to PNG, sends them over the private output channel,
and closes them. Remaining open figures are also captured after successful
execution. This supports Seaborn and empiricaldist plots without giving the renderer ownership
of the page DOM. Figures are displayed in source order alongside text, with
accessible descriptions and PNG download links. Image object URLs remain
valid after execution and are revoked on rerun, reset or navigation.
Python warnings remain visible as warnings rather than execution errors.
Renderer warnings follow the generated image, so diagnostics do not obscure
the result. The pinned Matplotlib/Pyodide combination currently emits native
coordinate deprecation warnings during PNG export; these are preserved.

Plot output is limited to eight images, 4 MB per image and 16 MB total. The
browser also validates these limits before rendering. PNG is deliberate:
there is no arbitrary SVG/HTML insertion or GUI event loop. Interactive zoom,
desktop backends, notebook widgets and animation export are not provided.
Readers can set figure size, DPI and styles through normal Matplotlib APIs;
generated images retain their plot colours when the site theme changes.

`print` and stderr are captured; standalone scripts use `print` for values. There is no `micropip`, arbitrary PyPI resolution, reader wheel
URL installer or `loadPackagesFromImports` call. Other native packages must
have compatible Pyodide builds. Adding a package requires an explicit change
to the approved roots or a pinned pure-Python wheel, review of its dependency
graph and provenance, a successful browser import and meaningful numerical or
plot tests. Source code retains normal Worker network APIs; this package
policy is not a security sandbox for hostile programs.

References: [Pyodide package loading](https://pyodide.org/en/stable/usage/loading-packages.html),
[self-hosting specific wheels](https://pyodide.org/en/stable/usage/working-with-bundlers.html#option-2-bundle-specific-packages-locally),
[Matplotlib backends](https://matplotlib.org/stable/users/explain/figure/backends.html),
and [official Seaborn installation](https://seaborn.pydata.org/installing.html).

Text output is rendered without interpreting HTML, bounded to 500 messages /
64 KB. Code, grammar and
results stay in the page and are not saved to browser storage or sent to a
code-execution server. User code can make its own network requests using the
APIs available in a Worker.

## Interactive input

Python `input(prompt)` displays a labelled line input below the output and
resumes the existing execution after submission. It uses Pyodide's `run_sync`
and requires WebAssembly JavaScript Promise Integration (JSPI). A runtime check
reports a useful error in unsupported browsers. `await read_input(prompt)` is
also available and works without JSPI; use it in async functions or at the top
level. Source is not rewritten or replayed. `sys.stdin` streaming APIs are not
connected to the line-input UI. IPython HTML values remain text; notebook mode does not provide a Jupyter
server, arbitrary HTML display or widget runtime.

JavaScript and TypeScript use `await input(prompt)`; EOF returns `null`.
Python raises `EOFError` on EOF. Empty strings, Unicode, and repeated requests
are supported. A private MessagePort matches one outstanding request to a
numbered reply. Input is bounded to 16,000 characters and rendered as text.
Readers submit using Enter or Send, or choose End input (EOF). Stop, Reset and
navigation terminate the pending execution and hide the input. Waiting for a
reader pauses the execution deadline; active execution time is cumulative
across submissions, so asking again does not reset the execution time budget.

References: [Pyodide JSPI and run_sync](https://blog.pyodide.org/posts/jspi/),
[Pyodide streams](https://pyodide.org/en/stable/usage/streams.html).

## Verification

`npm run check` covers configuration, grammar parsing and TS compilation.
`npm run test:playground:browser` uses a running `astro dev --background`
server, or `PLAYGROUND_BASE`, and exercises real runtimes, cancellation,
errors, approved scientific libraries, PNG plots, author-defined grammars and
navigation. Notebook regression tests additionally cover shared state, last-expression
display, stale results, environment isolation, source reset, restart, edited
notebook export, interactive input and stopping Run all after an error. The
published example routes are `/posts/build/browser-code/` and
`/posts/build/python-notebook/`. For a production check, run `npm run build`,
start `astro preview`, then run the same browser tests with `PLAYGROUND_BASE`
set to the preview URL.

## Linked Python notebook cells

Place `PythonNotebook.astro` once, then give body `CodePlayground` components
its `notebook` ID. IDs are author-controlled, unique per document, and only
valid with the Python runtime. Cells with another ID and ordinary playgrounds
have separate environments. The published guide is
`/posts/build/python-notebook/`.

```mdx
import PythonNotebook from '../../../components/PythonNotebook.astro';
import CodePlayground from '../../../components/CodePlayground.astro';

<PythonNotebook id="lesson" />
<CodePlayground notebook="lesson" language="python" title="Data"
  code={`values = [2, 4, 6]`} />
<CodePlayground notebook="lesson" language="python" title="Mean"
  code={`sum(values) / len(values)`} />
```

One persistent Python worker handles a notebook serially. Its namespace and
virtual files persist between cells; the worker loads once and approved
packages are cached for subsequent cells. Results are not replayed to rebuild
state. Last expressions and `display()` automatically produce readable text;
DataFrames and model tables retain their text data. HTML display objects are
parsed into text, never inserted as executable HTML. Plots use the existing
bounded PNG channel. Limits reset per cell, with the existing input/deadline
behaviour. Stdout, errors and images stay in the cell that produced them.

Run all follows DOM order, skips `runAll={false}` exercises, and stops at the
first failed cell. It uses current edited code. An error keeps changes already
made before the exception, as in an interactive Python session. Restart clears
the worker/variables/files while preserving source and marking old results as
stale. Stop and timeouts also restart the environment because this deployment
does not provide a shared-memory interrupt buffer. A change or rerun marks
later results stale; the application does not infer or rerun dependencies.
Execution counts reflect actual execution order, rather than document order.
Reset code only restores a cell's original source and clears its output; it
preserves shared variables. Source reset is disabled while a notebook is running.

Default component children can supply a book/reference output. It is labelled
as unexecuted, available without JavaScript, and replaced when that cell runs.
Reference Figure components outside cells remain independent of computed cell
plots; explain that distinction in the surrounding prose.

Editors mount near the viewport, so Run all can use untouched source directly
from its server-rendered textarea. Notebook editors share a tokenizer worker
per author grammar set. A long chapter does not launch one highlighter worker
for every cell. Navigation disposes both execution and highlighting workers.

Save edited notebook exports current source as nbformat 4, with empty outputs
and null counts; it does not imply that earlier outputs match edited source.
`PythonNotebook` accepts an optional `attribution` string, included in the
export's introductory Markdown cell, for source and license information.
Simple top-level `DATA_URL = "/datasets/example/"` assignments are made absolute
on export so dataset links retain the site's origin. This does not install
dependencies or translate browser-specific APIs for desktop Python.
