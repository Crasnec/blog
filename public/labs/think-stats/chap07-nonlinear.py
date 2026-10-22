# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from scipy.stats import spearmanr

choice = (await read_input("관계 (square / absolute / linear, 기본 square): ")).strip() or "square"
x = np.linspace(-1, 1, 101)
functions = {"square": lambda x: x**2, "absolute": np.abs, "linear": lambda x: x}
if choice not in functions:
    raise ValueError("square, absolute, linear 중 하나를 입력하세요.")
y = functions[choice](x)
print(f"피어슨 상관: {np.corrcoef(x,y)[0,1]:.6f}")
print(f"스피어먼 상관: {spearmanr(x,y).statistic:.6f}")
print("상관이 0이어도 비선형 관계가 있을 수 있습니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.scatter(x, y, s=12)
plt.xlabel("x")
plt.ylabel(choice)
plt.tight_layout()
plt.show()
