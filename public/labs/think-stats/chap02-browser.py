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
from empiricaldist import FreqTab

field = (await read_input(
    "변수 이름 (prglngth / birthwgt_lb / birthwgt_oz / agepreg, 기본 prglngth): "
)).strip() or "prglngth"
labels = {"prglngth": "Weeks", "birthwgt_lb": "Pounds",
          "birthwgt_oz": "Ounces", "agepreg": "Age"}
if field not in labels:
    raise ValueError("안내에 있는 네 변수 중 하나를 입력하세요.")
ftab = FreqTab.from_seq(live[field], name=field)
print("도수분포표:")
print(ftab.to_string())
print("최빈값:", ftab.mode())
print("가장 작은 값 10개:\n" + ftab.iloc[:10].to_string())
print("가장 큰 값 10개:\n" + ftab.iloc[-10:].to_string())
ftab.bar(width=0.1 if field == "agepreg" else 0.8)
plt.xlabel(labels[field])
plt.ylabel("Frequency")
plt.title(field)
if field == "prglngth":
    plt.xlim(20, 50)
plt.tight_layout()
plt.show()

def cohen_effect_size(group1, group2):
    diff = group1.mean() - group2.mean()
    v1, v2 = group1.var(), group2.var()
    n1, n2 = group1.count(), group2.count()
    pooled_var = (n1 * v1 + n2 * v2) / (n1 + n2)
    return diff / np.sqrt(pooled_var)

a, b = firsts["prglngth"], others["prglngth"]
print("첫아이 / 다른 아이 자료 수:", a.count(), b.count())
print(f"평균 임신 기간: {a.mean():.6f} / {b.mean():.6f}주")
print(f"차이: {a.mean() - b.mean():.6f}주 ({(a.mean()-b.mean())*7*24:.6f}시간)")
print(f"코언의 효과 크기: {cohen_effect_size(a, b):.6f}")

# Add your own analysis here; live, firsts, and others are available.
