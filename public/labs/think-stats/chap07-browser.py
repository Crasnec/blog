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
import matplotlib.pyplot as plt
from scipy.stats import spearmanr
from pyodide.http import pyfetch

filename = "nlsy97-extract.csv.gz"
response = await pyfetch("/labs/think-stats/" + filename)
if not response.ok:
    raise RuntimeError(f"Could not read data: HTTP {response.status}")
with open(filename, "wb") as stream:
    stream.write(await response.bytes())
nlsy = pd.read_csv(filename).replace([-1, -2, -3, -4, -5], np.nan)
raw_shape = nlsy.shape
for name, column in {"sat_verbal":"R9793800", "sat_math":"R9793900",
                     "piat_math":"R1318200", "income":"U4949700"}.items():
    nlsy[name] = nlsy[column]
for name in ["sat_verbal", "sat_math"]:
    nlsy.loc[nlsy[name] < 200, name] = np.nan

y_name = (await read_input("y축 변수 (sat_math / sat_verbal / income, 기본 sat_math): ")).strip() or "sat_math"
jitter_text = (await read_input("x축 지터의 표준편차 (기본 3, 0~10): ")).strip()
jitter_std = float(jitter_text or "3")
if y_name not in ["sat_math", "sat_verbal", "income"]:
    raise ValueError("안내에 있는 세 변수 중 하나를 입력하세요.")
if not np.isfinite(jitter_std) or not 0 <= jitter_std <= 10:
    raise ValueError("지터 표준편차는 0~10이어야 합니다.")
valid = nlsy.dropna(subset=["piat_math", y_name])
x, y = valid["piat_math"], valid[y_name]
pearson = np.corrcoef(x, y)[0, 1]
spearman = spearmanr(x, y).statistic
print("NLSY 원자료 행과 열:", raw_shape)
print("사용한 관측 쌍:", len(valid))
print(f"피어슨 상관: {pearson:.6f}")
print(f"스피어먼 상관 (동점은 평균 순위): {spearman:.6f}")
print("상관은 지터를 주기 전 자료로 계산합니다.")

# A fixed seed keeps visual comparisons reproducible; statistics use x and y.
np.random.seed(17)
x_plot = x + np.random.normal(0, jitter_std, len(x))
plt.scatter(x_plot, y, s=5, alpha=0.2)
plt.xlabel("PIAT Math")
plt.ylabel(y_name)
plt.tight_layout()
plt.show()

deciles = pd.qcut(x, 10, labels=False, duplicates="drop")
groups = valid.groupby(deciles, observed=True)
xs = groups["piat_math"].median()
ys = groups[y_name]
plt.fill_between(xs, ys.quantile(0.1), ys.quantile(0.9), alpha=0.2)
plt.plot(xs, ys.median(), label="median")
plt.xlabel("PIAT Math (group medians)")
plt.ylabel(y_name)
plt.legend()
plt.tight_layout()
plt.show()

# Add your own analysis here; nlsy and valid are available.
