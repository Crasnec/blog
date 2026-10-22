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
from scipy.stats import norm, gaussian_kde
from pyodide.http import pyfetch

response = await pyfetch("/labs/think-stats/penguins_raw.csv")
if not response.ok:
    raise RuntimeError(f"Could not read data: HTTP {response.status}")
with open("penguins_raw.csv", "wb") as stream:
    stream.write(await response.bytes())
penguins = pd.read_csv("penguins_raw.csv").dropna(subset=["Body Mass (g)"])
chinstrap = penguins.query('Species.str.startswith("Chinstrap")')
weights = chinstrap["Body Mass (g)"] / 1000
m, s = np.mean(weights), np.std(weights)

n_text = (await read_input("가상 조사의 표본 크기 (기본 68, 2~500): ")).strip()
level_text = (await read_input("신뢰수준 (기본 90, 50~99): ")).strip()
n = int(n_text or "68")
level = float(level_text or "90")
if not 2 <= n <= 500 or not np.isfinite(level) or not 50 <= level <= 99:
    raise ValueError("표본 크기는 2~500의 정수, 신뢰수준은 50~99여야 합니다.")

# A new seed, separate from earlier notebook experiments, makes this lab reproducible.
np.random.seed(1)
samples = np.random.normal(m, s, size=(1001, n))
sample_means = samples.mean(axis=1)
standard_error = np.std(sample_means)
tail = (100 - level) / 2
low, high = np.percentile(sample_means, [tail, 100-tail])
print("실제 관측한 턱끈펭귄 수:", len(weights))
print(f"관측 체중의 평균: {m:.6f} kg")
print(f"개별 체중의 표준편차 (ddof=0): {s:.6f} kg")
print(f"가상 표본 크기: {n}, 재표집 횟수: {len(sample_means)}")
print(f"평균의 표준오차 (재표집): {standard_error:.6f} kg")
print(f"평균의 표준오차 (s/sqrt(n)): {s/np.sqrt(n):.6f} kg")
print(f"{level:g}% 근사 구간: [{low:.6f}, {high:.6f}] kg")
print(f"구간 너비: {high-low:.6f} kg")
print("표본 크기를 늘리면 평균의 표집 변동이 줄어듭니다.")
print("이 구간에는 표집편향이나 측정 오류가 포함되지 않습니다.")

qs = np.linspace(weights.min()-0.2, weights.max()+0.2, 501)
plt.plot(qs, gaussian_kde(weights)(qs))
plt.axvline(m, color="gray", ls=":")
plt.xlim(qs[0], qs[-1])
plt.title("Individual penguin weights")
plt.xlabel("Weight (kg)")
plt.ylabel("Density")
plt.tight_layout()
plt.show()

plt.plot(qs, gaussian_kde(sample_means)(qs), label="sample means")
plt.axvspan(low, high, alpha=0.2, label=f"{level:g}% interval")
plt.axvline(m, color="gray", ls=":")
plt.xlim(qs[0], qs[-1])
plt.title(f"Sample means (n={n})")
plt.xlabel("Mean weight (kg)")
plt.ylabel("Density")
plt.legend()
plt.tight_layout()
plt.show()

# Add your own analysis here; weights and sample_means are available.
