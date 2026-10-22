# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from empiricaldist import Cdf, Pmf

answer = (await read_input("생성할 표본 수 (기본 100, 10~1000): ")).strip()
n = int(answer or "100")
if not 10 <= n <= 1000:
    raise ValueError("10~1000의 정수를 입력하세요.")
cdf = Cdf.from_seq([1, 2, 2, 3, 5])
rng = np.random.default_rng(1)
uniform = rng.random(n)
sample = cdf.inverse(uniform)
observed = Pmf.from_seq(sample)
print("원래 확률: {1: 0.2, 2: 0.4, 3: 0.2, 5: 0.2}")
print("생성한 표본의 상대도수:")
print(observed.to_string())
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

observed.bar()
plt.xlabel("Value")
plt.ylabel("Relative frequency")
plt.tight_layout()
plt.show()
