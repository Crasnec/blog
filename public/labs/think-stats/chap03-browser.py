# Browser adaptation of Think Stats by Allen B. Downey (MIT).
# Original code license: /labs/think-stats/LICENSE-code.txt
# This script uses chapter 1's reader; no GPL helper modules are bundled.
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
from empiricaldist import Pmf

pmf = Pmf.from_seq([1, 2, 2, 3, 5])
print("값과 확률:\n" + pmf.to_string())
print(f"확률 합: {pmf.sum():.1f}, 평균: {pmf.mean():.1f}, 분산: {pmf.var():.2f}")

# The default counts and integer representatives match chapter 3 exactly.
ranges = pd.interval_range(start=5, end=50, freq=5, closed="left")
sizes = ranges.left + 2
counts = np.array([8, 8, 14, 4, 6, 12, 8, 3, 2])
answer = (await read_input("5~9명 수업의 수 (기본 8, 0~1000): ")).strip()
small_classes = int(answer or "8")
if not 0 <= small_classes <= 1000:
    raise ValueError("0부터 1000 사이의 정수를 입력하세요.")
counts[0] = small_classes
actual = Pmf(counts, sizes, name="actual")
actual.normalize()

def bias(pmf, name):
    ps = pmf.ps * pmf.qs
    new_pmf = Pmf(ps, pmf.qs, name=name)
    new_pmf.normalize()
    return new_pmf

def unbias(pmf, name):
    ps = pmf.ps / pmf.qs
    new_pmf = Pmf(ps, pmf.qs, name=name)
    new_pmf.normalize()
    return new_pmf

observed = bias(actual, "observed")
debiased = unbias(observed, "debiased")
print(f"수업 단위 평균: {actual.mean():.6f}명")
print(f"학생이 관측한 평균: {observed.mean():.6f}명")
print(f"편향 보정 뒤 평균: {debiased.mean():.6f}명")
print("수업 수를 바꿔 다시 실행해 두 평균의 차이를 비교하세요.")
actual.bar(align="edge", width=-2)
observed.bar(align="edge", width=2, alpha=0.5)
plt.xlabel("Class size")
plt.ylabel("PMF")
plt.legend()
plt.tight_layout()
plt.show()

# Add your own analysis here; actual and observed are available.
