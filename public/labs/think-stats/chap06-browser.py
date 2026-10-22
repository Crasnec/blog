# Browser adaptation of Think Stats by Allen B. Downey (MIT).
# Original code license: /labs/think-stats/LICENSE-code.txt
# No GPL helper modules are bundled.
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

import matplotlib.pyplot as plt
from scipy.stats import norm, trimboth, gaussian_kde
from scipy.integrate import simpson

low_text = (await read_input("구간의 아래 경계 (파운드, 기본 6): ")).strip()
high_text = (await read_input("구간의 위 경계 (파운드, 기본 8): ")).strip()
bw_text = (await read_input("KDE 대역폭 계수 (기본 scott, 또는 0.05~1): ")).strip()
low, high = float(low_text or "6"), float(high_text or "8")
if not np.isfinite([low, high]).all() or not 0 <= low < high <= 20:
    raise ValueError("0 <= 아래 경계 < 위 경계 <= 20이어야 합니다.")
bw = "scott" if not bw_text or bw_text == "scott" else float(bw_text)
if isinstance(bw, float) and (not np.isfinite(bw) or not 0.05 <= bw <= 1):
    raise ValueError("대역폭은 scott 또는 0.05~1의 숫자여야 합니다.")

birth_weights = preg["totalwgt_lb"].dropna()
trimmed = trimboth(birth_weights, 0.01)
m, s = np.mean(trimmed), np.std(trimmed)
kde = gaussian_kde(birth_weights, bw_method=bw)
qs = np.linspace(0, 16, 501)
interval_qs = np.linspace(low, high, 501)
numeric_area = simpson(y=norm.pdf(interval_qs, m, s), x=interval_qs)
cdf_area = norm.cdf(high, m, s) - norm.cdf(low, m, s)
empirical = ((birth_weights >= low) & (birth_weights <= high)).mean()
print(f"체중 자료 수: {birth_weights.count()}")
print(f"양 끝 제외 뒤 평균: {m:.6f} lb, 표준편차: {s:.6f} lb")
print(f"평균에서의 정규 PDF 높이: {norm.pdf(m,m,s):.6f} (1/lb)")
print(f"구간 [{low:g}, {high:g}] lb의 정규 모형 확률 (수치 적분): {numeric_area:.12f}")
print(f"같은 확률 (CDF 차이): {cdf_area:.12f}")
print(f"원자료의 같은 구간 비율 (양 끝 포함): {empirical:.6f}")
print(f"KDE의 구간 확률: {kde.integrate_box_1d(low, high):.6f}")
print(f"KDE 대역폭 계수: {kde.factor:.6f}")
plt.plot(qs, norm.pdf(qs, m, s), label="normal model", ls="--")
plt.plot(qs, kde(qs), label="KDE")
plt.fill_between(interval_qs, 0, norm.pdf(interval_qs,m,s), alpha=0.2,
                 label="normal interval probability")
plt.xlabel("Birth weight (pounds)")
plt.ylabel("Density (1/pound)")
plt.legend()
plt.tight_layout()
plt.show()

# Add your own analysis here; birth_weights, kde, m, and s are available.
