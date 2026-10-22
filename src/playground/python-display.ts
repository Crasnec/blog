/** Notebook values stay text; HTML is never inserted into the document. */
export const installNotebookDisplay = String.raw`
import builtins as __nb_builtins
from html.parser import HTMLParser as __nb_HTMLParser
from pyodide.code import eval_code_async as __nb_eval

class __nb_Text(__nb_HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script"):
            self.skip += 1
        if tag in ("tr", "p", "br") and not self.skip:
            self.parts.append("\n")
    def handle_endtag(self, tag):
        if tag in ("style", "script"):
            self.skip = max(0, self.skip-1)
        if tag in ("td", "th") and not self.skip:
            self.parts.append("\t")
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

def __nb_display(*values, **options):
    for value in values:
        if value is None or type(value).__module__.startswith("matplotlib"):
            continue
        if hasattr(value, "as_text"):
            text = value.as_text()
        elif type(value).__name__ == "HTML" and hasattr(value, "data"):
            parser = __nb_Text()
            parser.feed(str(value.data))
            text = "".join(parser.parts).strip()
        else:
            text = repr(value)
        if text:
            print(text)

__nb_builtins.display = __nb_display
try:
    import IPython.display as __nb_ipython_display
    __nb_ipython_display.display = __nb_display
except ImportError:
    pass

async def __nb_run_cell(source):
    value = await __nb_eval(source, globals(), globals(), filename="<notebook cell>")
    __nb_display(value)
`;
