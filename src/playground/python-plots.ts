import { MAX_PNG } from "./contracts.ts";

/** Keep raster bytes out of HTML; plots travel on the private worker channel. */
export function pngFromBase64(encoded: string): ArrayBuffer {
	if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX_PNG / 3) * 4) throw new Error("Plot exceeds the 4 MB image limit");
	const binary = atob(encoded);
	const data = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) data[index] = binary.charCodeAt(index);
	if (data.byteLength > MAX_PNG || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => data[index] === byte)) throw new Error("Plot output must be a PNG image");
	return data.buffer;
}

/** Keep structured Python warnings distinct from execution errors. */
export const installWarningCapture = `
import warnings as __pg_warnings
from _playground import emit_warning as __pg_emit_warning

def __pg_showwarning(message, category, filename, lineno, file=None, line=None):
    __pg_emit_warning(__pg_warnings.formatwarning(message, category, filename, lineno, line))

__pg_warnings.showwarning = __pg_showwarning
`;

// Agg works without the DOM. Capture show() and remaining open figures at the
// end of a successful run; close rendered figures to avoid duplicate output.
export const installPlotCapture = `
import base64 as __pg_base64
import io as __pg_io
import matplotlib as __pg_mpl
__pg_mpl.use("Agg", force=True)
__pg_mpl.rcParams["figure.dpi"] = 120
import matplotlib.pyplot as __pg_plt
from _playground import emit_png as __playground_emit_png

def __playground_flush_plots(*args, **kwargs):
    for number in __pg_plt.get_fignums():
        figure = __pg_plt.figure(number)
        buffer = __pg_io.BytesIO()
        with __pg_warnings.catch_warnings(record=True) as notices:
            figure.savefig(buffer, format="png", dpi="figure")
        title = figure.get_suptitle() or next((axis.get_title() for axis in figure.axes if axis.get_title()), "Matplotlib figure")
        __playground_emit_png(__pg_base64.b64encode(buffer.getvalue()).decode("ascii"), title)
        __pg_plt.close(figure)
        for notice in notices:
            __pg_showwarning(notice.message, notice.category, notice.filename, notice.lineno)

__pg_plt.show = __playground_flush_plots
`;
