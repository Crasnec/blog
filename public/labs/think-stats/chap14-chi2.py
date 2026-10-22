# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import chi2

answer = (await read_input("다항 모의실험 수 (기본 10001, 999~20001): ")).strip()
repeats = int(answer or "10001")
if not 999 <= repeats <= 20001:
    raise ValueError("999~20001의 정수를 입력하세요.")
observed = np.array([8,9,19,5,8,11])
expected = observed.sum()/6
statistic = np.sum((observed-expected)**2/expected)
rng = np.random.default_rng(1)
counts = rng.multinomial(observed.sum(),np.full(6,1/6),size=repeats)
stats = np.sum((counts-expected)**2/expected,axis=1)
mc_p = (np.sum(stats>=statistic)+1)/(repeats+1)
analytic_p = chi2.sf(statistic,df=5)
print(f"관측 통계량: {statistic:.6f}, 자유도: 5")
print(f"다항 모의실험 p값 (+1 보정): {mc_p:.6f}")
print(f"카이제곱 근사 p값: {analytic_p:.6f}")
print(f"모의실험 비율의 대략적인 표준오차: {np.sqrt(mc_p*(1-mc_p)/repeats):.6f}")
print("근사분포 오차와 Monte Carlo 오차는 서로 다릅니다.")
xs = np.linspace(0,25,201)
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(xs,chi2.pdf(xs,df=5),label="chi-square approximation")
plt.fill_between(xs,chi2.pdf(xs,df=5),where=xs>=statistic,alpha=0.2)
plt.axvline(statistic,color="gray",ls=":")
plt.xlabel("Chi-squared statistic")
plt.ylabel("Density")
plt.tight_layout()
plt.show()
