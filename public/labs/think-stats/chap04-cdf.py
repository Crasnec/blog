# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from empiricaldist import Cdf

values = np.array([1, 2, 2, 3, 5])
cdf = Cdf.from_seq(values)
answer = (await read_input("몇 이하인지 확인할 값 (기본 2): ")).strip()
x = float(answer or "2")
if not np.isfinite(x):
    raise ValueError("유한한 수를 입력하세요.")
print(f"{x:g} 이하의 개수: {np.sum(values <= x)}/{len(values)}")
print(f"F({x:g}) = {cdf(x):.6f}")
print(f"0.5 분위수: {cdf.inverse(0.5):g}")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

cdf.step()
plt.axvline(x, ls=":", color="gray")
plt.xlabel("Value")
plt.ylabel("Cumulative probability")
plt.ylim(0, 1.05)
plt.tight_layout()
plt.show()
