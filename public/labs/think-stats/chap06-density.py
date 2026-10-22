# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from scipy.stats import norm

answer = (await read_input("정규분포의 표준편차 (기본 0.2, 0.05~2): ")).strip()
sd = float(answer or "0.2")
if not np.isfinite(sd) or not 0.05 <= sd <= 2:
    raise ValueError("0.05~2의 유한한 수를 입력하세요.")
model = norm(0, sd)
print(f"0에서의 밀도: {model.pdf(0):.6f}")
print(f"[-{sd:g}, {sd:g}] 안에 들어갈 확률: {model.cdf(sd)-model.cdf(-sd):.6f}")
print("밀도는 1을 넘을 수 있습니다. 확률은 곡선 아래의 넓이입니다.")
qs = np.linspace(-4*sd, 4*sd, 401)
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(qs, model.pdf(qs))
plt.fill_between(qs, model.pdf(qs), where=np.abs(qs)<=sd, alpha=0.2)
plt.xlabel("Value")
plt.ylabel("Density")
plt.tight_layout()
plt.show()
