# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import norm

family = (await read_input("분포 (exponential / lognormal / pareto / correlated, 기본 exponential): ")).strip() or "exponential"
answer = (await read_input("표본 크기 n (기본 10, 1~500): ")).strip()
n = int(answer or "10")
if family not in ["exponential","lognormal","pareto","correlated"] or not 1 <= n <= 500:
    raise ValueError("안내에 있는 분포와 1~500의 표본 크기를 입력하세요.")
rng = np.random.default_rng(1)
if family == "exponential":
    samples = rng.exponential(size=(1001,n));mu,sd = 1.0,1.0
elif family == "lognormal":
    samples = rng.lognormal(3,1,size=(1001,n));mu,sd = np.exp(3.5),np.sqrt((np.e-1)*np.exp(7))
elif family == "pareto":
    samples = 1+rng.pareto(1,size=(1001,n));mu,sd = None,None
else:
    rho = 0.8
    z = rng.normal(size=(1001,n))
    for i in range(1,n):
        z[:,i] = rho*z[:,i-1]+np.sqrt(1-rho**2)*z[:,i]
    samples = -np.log1p(-np.clip(norm.cdf(z),0,1-np.finfo(float).eps))
    mu,sd = 1.0,1.0
means = samples.mean(axis=1)
print(f"{family}, n={n}, 모의 표본 1001개")
print(f"표본평균들의 평균: {means.mean():.6f}, 표준편차: {means.std(ddof=1):.6f}")
if mu is not None:
    print(f"모평균: {mu:.6f}, 독립일 때의 기준 SE: {sd/np.sqrt(n):.6f}")
else:
    print("α=1 파레토에는 유한한 모평균·모분산이 없습니다. 위 수치는 이번 유한 실험의 요약입니다.")
if family == "correlated":
    print("의존 자료이므로 독립 표본의 SE 공식을 실제 SE로 쓰면 안 됩니다.")
ps = (np.arange(300)+0.5)/300
reference = norm.ppf(ps,loc=means.mean(),scale=means.std(ddof=1))
observed = np.quantile(means,ps)
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.scatter(reference,observed,s=8)
limits = [min(reference.min(),observed.min()),max(reference.max(),observed.max())]
plt.plot(limits,limits,color="gray",ls=":")
plt.xlabel("Fitted normal quantile of means")
plt.ylabel("Empirical quantile of means")
plt.tight_layout()
plt.show()
