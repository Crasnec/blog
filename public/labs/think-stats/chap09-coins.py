# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import binom

answer = (await read_input("250번 중 앞면 횟수 (기본 140, 0~250): ")).strip()
heads = int(answer or "140")
if not 0 <= heads <= 250:
    raise ValueError("0~250의 정수를 입력하세요.")
n, observed = 250, abs(heads-125)
rng = np.random.default_rng(1)
stats = np.abs(rng.binomial(n, 0.5, 10001)-125)
count = int(np.sum(stats >= observed))
qs = np.arange(126)
ps = binom.pmf(125+qs, n, 0.5)*2
ps[0] /= 2
exact_p = ps[qs >= observed].sum()
print(f"검정통계량 |앞면-125|: {observed}")
print(f"귀무모형의 극단적 결과: {count}/10001")
print(f"시뮬레이션 비율: {count/len(stats):.6f}")
print(f"이항분포로 구한 양측 p값: {exact_p:.6f}")
print("귀무가설이 참일 확률을 계산한 것이 아닙니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.bar(qs, ps)
plt.axvline(observed, color="gray", ls=":", label="observed")
plt.xlim(0, max(40, observed+3))
plt.xlabel("Absolute deviation from 125")
plt.ylabel("Probability")
plt.legend()
plt.tight_layout()
plt.show()
