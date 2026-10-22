# Browser adaptation of Think Stats by Allen B. Downey (MIT).
# Original code license: /labs/think-stats/LICENSE-code.txt
# This script uses chapter 1's reader; no GPL helper modules are bundled.
import warnings
from matplotlib import MatplotlibDeprecationWarning

# Pyodide's current Agg text renderer emits these two internal warnings.
# Filter only its deprecated pixel-coordinate conversion, not user warnings.
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

# Browser-only preparation: fetch the same NSFG files from this site.
for filename in ["2002FemPreg.dct", "2002FemPreg.dat.gz"]:
    response = await pyfetch("/labs/think-stats/" + filename)
    if not response.ok:
        raise RuntimeError(f"Could not read {filename}: HTTP {response.status}")
    with open(filename, "wb") as stream:
        stream.write(await response.bytes())

dct_file = "2002FemPreg.dct"
dat_file = "2002FemPreg.dat.gz"

from statadict import parse_stata_dict


def read_stata(dct_file, dat_file):
    stata_dict = parse_stata_dict(dct_file)
    resp = pd.read_fwf(
        dat_file,
        names=stata_dict.names,
        colspecs=stata_dict.colspecs,
        compression="gzip",
    )
    return resp

# Consolidate pandas blocks before adding the derived weight column.
preg = read_stata(dct_file, dat_file).copy()

preg["birthwgt_lb"] = preg["birthwgt_lb"].replace([51, 97, 98, 99], np.nan)
preg["birthwgt_oz"] = preg["birthwgt_oz"].replace([97, 98, 99], np.nan)
preg["agepreg"] /= 100.0
preg["totalwgt_lb"] = preg["birthwgt_lb"] + preg["birthwgt_oz"] / 16.0
live = preg.query("outcome == 1")
firsts = live.query("birthord == 1")
others = live.query("birthord != 1")

import matplotlib.pyplot as plt
from empiricaldist import Cdf

weight_text = (await read_input("비교할 출생 체중 (파운드, 기본 8.5): ")).strip()
weight = float(weight_text or "8.5")
if not np.isfinite(weight) or not 0 < weight <= 30:
    raise ValueError("0보다 크고 30 이하인 체중을 입력하세요.")
sample_text = (await read_input("무작위 표본 크기 (기본 1001, 10~10000): ")).strip()
sample_n = int(sample_text or "1001")
if not 10 <= sample_n <= 10000:
    raise ValueError("10부터 10000 사이의 정수를 입력하세요.")

first_cdf = Cdf.from_seq(firsts["totalwgt_lb"], name="first")
other_cdf = Cdf.from_seq(others["totalwgt_lb"], name="other")
for name, cdf in [("첫아이", first_cdf), ("다른 아이", other_cdf)]:
    low, median, high = cdf.inverse([0.25, 0.5, 0.75])
    print(f"{name}: {weight:g} lb 이하 {cdf(weight)*100:.6f}%")
    print(f"  중앙값 {median:.6f} lb, IQR {high-low:.6f} lb")
first_cdf.plot(ls="--")
other_cdf.plot(alpha=0.5)
plt.axvline(weight, ls=":", color="gray")
plt.xlabel("Weight (pounds)")
plt.ylabel("CDF")
plt.legend()
plt.tight_layout()
plt.show()

# No fixed seed: re-running also demonstrates sampling variation.
live_cdf = Cdf.from_seq(live["totalwgt_lb"], name="original")
sample = live_cdf.inverse(np.random.random(size=sample_n))
sample_cdf = Cdf.from_seq(sample, name="sample")
print(f"생성한 표본 수: {sample_n}")
live_cdf.plot(ls="--")
sample_cdf.plot(alpha=0.5)
plt.xlabel("Weight (pounds)")
plt.ylabel("CDF")
plt.legend()
plt.tight_layout()
plt.show()

# Add your own analysis here; live, firsts, others, and sample are available.
