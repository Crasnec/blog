# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from scipy.stats import gaussian_kde

values = np.array([1, 2, 2, 3, 5])
answer = (await read_input("커널의 표준편차 h (기본 0.5, 0.05~3): ")).strip()
h = float(answer or "0.5")
if not np.isfinite(h) or not 0.05 <= h <= 3:
    raise ValueError("0.05~3의 유한한 수를 입력하세요.")
# SciPy multiplies this factor by the sample SD (ddof=1).
kde = gaussian_kde(values, bw_method=h/values.std(ddof=1))
print(f"커널 표준편차: {np.sqrt(kde.covariance[0, 0]):.6f}")
print(f"전체 넓이: {kde.integrate_box_1d(-np.inf, np.inf):.6f}")
print(f"[0, 4] 안의 추정 확률: {kde.integrate_box_1d(0, 4):.6f}")
qs = np.linspace(values.min()-4*h, values.max()+4*h, 501)
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(qs, kde(qs))
plt.plot(values, np.zeros(len(values)), "|", ms=14)
plt.xlabel("Value")
plt.ylabel("Density")
plt.tight_layout()
plt.show()
