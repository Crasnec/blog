# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np

answer = (await read_input("모집단 상관 rho (기본 0.7, -0.99~0.99): ")).strip()
rho = float(answer or "0.7")
if not np.isfinite(rho) or not -0.99 <= rho <= 0.99:
    raise ValueError("-0.99~0.99의 유한한 수를 입력하세요.")
rng = np.random.default_rng(17)
x, noise = rng.normal(size=(2, 200))
y = rho*x + np.sqrt(1-rho**2)*noise
print(f"설정한 모집단 상관: {rho:.6f}")
print(f"200쌍에서 계산한 표본 상관: {np.corrcoef(x,y)[0,1]:.6f}")
print("유한한 표본의 상관은 설정값과 정확히 같지 않습니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.scatter(x, y, s=12, alpha=0.4)
plt.xlabel("x")
plt.ylabel("y")
plt.tight_layout()
plt.show()
