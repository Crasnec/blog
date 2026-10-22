# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np

answer = (await read_input("마지막 값 (기본 5, 5~100): ")).strip()
last = float(answer or "5")
if not np.isfinite(last) or not 5 <= last <= 100:
    raise ValueError("5~100의 유한한 수를 입력하세요.")
values = np.array([1, 2, 2, 3, last])
print("관측값:", values.tolist())
print(f"평균: {values.mean():.2f}")
print(f"중앙값: {np.median(values):.2f}")
print(f"표준편차 (ddof=0): {values.std():.2f}")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(values, np.zeros(len(values)), "o", label="observations")
plt.axvline(values.mean(), label="mean")
plt.axvline(np.median(values), ls="--", label="median")
plt.xlim(0, 105)
plt.yticks([])
plt.xlabel("Value")
plt.legend()
plt.tight_layout()
plt.show()
