# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from empiricaldist import Pmf

answer = (await read_input("값 목록 (기본 1 2 2 3 5): ")).strip()
values = np.array([float(v) for v in (answer or "1 2 2 3 5").split()])
if not 2 <= len(values) <= 40 or not np.isfinite(values).all():
    raise ValueError("유한한 수 2~40개를 입력하세요.")
pmf = Pmf.from_seq(values)
print(pmf.to_string())
print(f"확률 합: {pmf.sum():.6f}")
print(f"평균: {pmf.mean():.6f}, 분산: {pmf.var():.6f}")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

pmf.bar()
plt.xlabel("Value")
plt.ylabel("Probability")
plt.tight_layout()
plt.show()
