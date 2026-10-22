# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import chisquare

choice = (await read_input("통계량 (chi2 / absolute, 기본 chi2): ")).strip() or "chi2"
if choice not in ["chi2", "absolute"]:
    raise ValueError("chi2 또는 absolute를 입력하세요.")
observed = np.array([8,9,19,5,8,11])
expected = np.full(6, observed.sum()/6)
rng = np.random.default_rng(1)
simulated = rng.multinomial(observed.sum(), np.full(6,1/6), size=10001)
if choice == "chi2":
    statistic = np.sum((observed-expected)**2/expected)
    stats = np.sum((simulated-expected)**2/expected, axis=1)
else:
    statistic = np.abs(observed-expected).sum()
    stats = np.abs(simulated-expected).sum(axis=1)
p = (1+np.sum(stats >= statistic))/(len(stats)+1)
print("관측 도수:", observed.tolist())
print(f"검정통계량 ({choice}): {statistic:.6f}")
print(f"Monte Carlo p값 (+1 보정): {p:.6f}")
if choice == "chi2":
    print(f"자유도 5의 카이제곱 근사: {chisquare(observed, expected).pvalue:.6f}")
print("통계량을 고르는 방식에 따라 다른 차이를 강조합니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.hist(stats, bins=30, density=True, alpha=0.5)
plt.axvline(statistic, color="gray", ls=":")
plt.xlabel(choice)
plt.ylabel("Density")
plt.tight_layout()
plt.show()
