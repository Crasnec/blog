# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

response = await pyfetch("/labs/think-stats/penguins_raw.csv")
if not response.ok:
    raise RuntimeError(f"Data download failed: {response.status}")
with open("penguins_raw.csv", "wb") as stream:
    stream.write(await response.bytes())
penguins = pd.read_csv("penguins_raw.csv").rename(columns={
    "Body Mass (g)": "mass", "Flipper Length (mm)": "flipper_length",
    "Culmen Length (mm)": "culmen_length", "Culmen Depth (mm)": "culmen_depth",
})
adelie = penguins[penguins["Species"].str.startswith("Adelie")].dropna(subset=["mass"])

from scipy.stats import linregress

answer = (await read_input("재표집 수 (기본 1001, 199~2001): ")).strip()
level_text = (await read_input("신뢰수준 (기본 90, 50~99): ")).strip()
repeats, level = int(answer or "1001"), float(level_text or "90")
if not 199 <= repeats <= 2001 or not np.isfinite(level) or not 50 <= level <= 99:
    raise ValueError("재표집 수 199~2001, 신뢰수준 50~99를 입력하세요.")
x, y = adelie["flipper_length"].to_numpy(), adelie["mass"].to_numpy()
fit = linregress(x,y)
rng = np.random.default_rng(1)
slopes = np.empty(repeats)
for i in range(repeats):
    ids = rng.integers(0,len(x),len(x))
    slopes[i] = linregress(x[ids],y[ids]).slope
alpha = (100-level)/2
low, high = np.percentile(slopes,[alpha,100-alpha])
print(f"관측 기울기: {fit.slope:.6f} g/mm")
print(f"재표집 표준오차: {slopes.std(ddof=1):.6f} g/mm")
print(f"linregress의 모형 기반 표준오차: {fit.stderr:.6f} g/mm")
print(f"{level:g}% 백분위 구간: [{low:.6f}, {high:.6f}] g/mm")
print("한 펭귄의 체중에 대한 예측구간과는 다릅니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.hist(slopes,bins=30,density=True,alpha=0.5)
plt.axvspan(low,high,alpha=0.15)
plt.xlabel("Slope (g/mm)")
plt.ylabel("Density")
plt.tight_layout()
plt.show()
