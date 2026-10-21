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
- `timeout`: execution limit in milliseconds, from 100 to 60,000; default 10,000.
  Loading the runtime and libraries has a separate 180-second limit. Stop
  works while loading.
- `pythonPackages`: optional array of approved package names to preload for
  dynamic imports. Ordinary imports are detected automatically. Names must be
  unique and require the Python runtime.

For a custom grammar, import it with Vite's `?raw` suffix and pass its text.
See `src/content/posts/build/browser-code.mdx` for all three runtimes and a
two-file TextMate grammar using an external `include`. Readers can also load
grammar files locally; these files are not uploaded. Reset grammar restores
the author's original grammar set. Highlighting and execution are independent.

TextMate tokenization uses Shiki's Oniguruma WASM engine in its own Worker,
including repository rules, begin/end state across lines, captures and external
scope includes when their grammars are supplied. Unknown scopes use the base
text colour. Colours use CSS variables, so changing the site's theme does not
discard editor contents, selection or undo history. A 15-second highlighting
deadline terminates a stalled grammar worker; the code remains editable.

Every execution starts a fresh Worker and terminates it on completion, Stop,
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

Python provides its standard library and five approved scientific packages:

| Import | Pinned version | Distribution |
| --- | --- | --- |
| `numpy` | 2.4.6 | Pyodide 314.0.7 |
| `pandas` | 3.0.2 | Pyodide 314.0.7 |
| `scipy` | 1.18.0 | Pyodide 314.0.7 |
| `matplotlib` | 3.10.8 | Pyodide 314.0.7 |
| `seaborn` | 0.13.2 | Official pure-Python PyPI wheel |

The approved roots are defined in `python-libraries.json`. The versioned npm
runtime's lockfile fixes native wheel versions, dependency metadata and
SHA-256 digests. Seaborn is absent from that catalog, so
`scripts/python-packages.mjs` adds its explicitly pinned official PyPI wheel
and dependencies. The Seaborn profile includes SciPy for statistical plots.
The resulting fifteen-wheel dependency graph is roughly
31 MB in this release, in addition to the runtime; readers fetch only the
packages needed by their code. No new npm dependencies are needed.

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
reduced lockfile determines their dependencies. Standard-library examples
do not download scientific wheels. For a dynamic import, declare it explicitly:

```mdx
<CodePlayground language="python" pythonPackages={["numpy"]}
  code={`np = __import__("numpy")
print(np.arange(4))`} />
```

Matplotlib uses its non-interactive Agg backend in the Worker. `plt.show()`
serializes open figures to PNG, sends them over the private output channel,
and closes them. Remaining open figures are also captured after successful
execution. This supports Seaborn plots without giving the renderer ownership
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

`print` and stderr are captured; use `print` for values. Interactive `input`
is unavailable. There is no `micropip`, arbitrary PyPI resolution, reader wheel
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

## Verification

`npm run check` covers configuration, grammar parsing and TS compilation.
`npm run test:playground:browser` uses a running `astro dev --background`
server, or `PLAYGROUND_BASE`, and exercises real runtimes, cancellation,
errors, approved scientific libraries, PNG plots, grammar replacement and
navigation. The published example route is
`/posts/build/browser-code/`. For a production check, run `npm run build`,
start `astro preview`, then run the same browser tests with `PLAYGROUND_BASE`
set to the preview URL.
