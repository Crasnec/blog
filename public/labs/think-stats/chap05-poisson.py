# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from scipy.stats import poisson

answer = (await read_input("경기당 평균 득점 (기본 6, 0.1~15): ")).strip()
rate = float(answer or "6")
if not np.isfinite(rate) or not 0.1 <= rate <= 15:
    raise ValueError("0.1~15의 유한한 수를 입력하세요.")
rng = np.random.default_rng(1)
sample = rng.poisson(rate, size=1000)
ks = np.arange(41)
print(f"모형의 평균·분산: {rate:.6f}")
print(f"1000경기의 평균: {sample.mean():.6f}, 분산: {sample.var():.6f}")
print(f"0골일 확률: {poisson.pmf(0, rate):.6f}")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.bar(ks, np.bincount(sample, minlength=41)[:41] / len(sample), label="simulation", alpha=0.5)
plt.plot(ks, poisson.pmf(ks, rate), "o", label="Poisson model")
plt.xlabel("Goals per game")
plt.ylabel("Probability")
plt.legend()
plt.tight_layout()
plt.show()
