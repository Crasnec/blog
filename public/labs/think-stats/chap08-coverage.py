# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt

import numpy as np
from scipy.stats import norm

answer = (await read_input("조사 한 번의 표본 크기 (기본 20, 5~200): ")).strip()
n = int(answer or "20")
if not 5 <= n <= 200:
    raise ValueError("5~200의 정수를 입력하세요.")
mu, sigma = 3.7, 0.46
rng = np.random.default_rng(1)
means = rng.normal(mu, sigma, size=(1000, n)).mean(axis=1)
# Known population SD: exact 90% normal intervals in this artificial model.
margin = norm.ppf(0.95)*sigma/np.sqrt(n)
low, high = means-margin, means+margin
covered = (low <= mu) & (mu <= high)
print(f"알려진 모표준편차: {sigma:.2f} kg")
print(f"표본평균의 표준오차: {sigma/np.sqrt(n):.6f} kg")
print(f"모평균을 포함한 구간: {covered.sum()}/1000")
print(f"첫 구간: [{low[0]:.6f}, {high[0]:.6f}] kg")
print("90%는 이 절차를 반복할 때의 포함률을 뜻합니다.")
for i in range(30):
    plt.plot([low[i], high[i]], [i,i], color="gray" if covered[i] else "red")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.axvline(mu, ls=":", label="true mean")
plt.xlabel("Mean weight (kg)")
plt.ylabel("Repeated survey (first 30)")
plt.legend()
plt.tight_layout()
plt.show()
