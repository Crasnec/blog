# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from scipy.stats import expon

answer = (await read_input("경기당 득점률 (기본 6, 0.1~20): ")).strip()
rate = float(answer or "6")
if not np.isfinite(rate) or not 0.1 <= rate <= 20:
    raise ValueError("0.1~20의 유한한 수를 입력하세요.")
model = expon(scale=1/rate)
print(f"평균 대기 시간: {model.mean()*60:.6f}분")
print(f"첫 1분 안에 득점할 확률: {model.cdf(1/60):.6f}")
print("시간에 따라 득점률이 일정하고, 서로 독립인 발생을 가정합니다.")
qs = np.linspace(0, 1, 201)
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(qs*60, model.cdf(qs))
plt.xlabel("Minutes")
plt.ylabel("Cumulative probability")
plt.tight_layout()
plt.show()
