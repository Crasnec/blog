# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from empiricaldist import FreqTab

answer = (await read_input("값 목록 (기본 1 2 2 3 5, 공백으로 구분): ")).strip()
values = np.array([float(v) for v in (answer or "1 2 2 3 5").split()])
if not 2 <= len(values) <= 40 or not np.isfinite(values).all():
    raise ValueError("유한한 수 2~40개를 입력하세요.")
freq = FreqTab.from_seq(values)
print(freq.to_string())
print("도수의 합:", freq.sum())
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

freq.bar()
plt.xlabel("Value")
plt.ylabel("Frequency")
plt.tight_layout()
plt.show()
