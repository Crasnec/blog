# Browser adaptation of Think Stats by Allen B. Downey (MIT).
# Original code license: /labs/think-stats/LICENSE-code.txt
# No GPL helper modules are bundled.
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
import matplotlib.pyplot as plt
from scipy.special import comb
from empiricaldist import Pmf

n_text = (await read_input("한 라운드의 표적 수 (기본 25, 1~100): ")).strip()
p_text = (await read_input("명중 확률 (기본 0.9, 0~1): ")).strip()
n, p = int(n_text or "25"), float(p_text or "0.9")
if not 1 <= n <= 100 or not np.isfinite(p) or not 0 <= p <= 1:
    raise ValueError("표적 수는 1~100의 정수, 확률은 0~1이어야 합니다.")

def flip(n, p):
    choices = [1, 0]
    probs = [p, 1 - p]
    return np.random.choice(choices, n, p=probs)

def simulate_round(n, p):
    return flip(n, p).sum()

def binomial_pmf(k, n, p):
    return comb(n, k) * (p**k) * ((1 - p) ** (n - k))

# Preserve the book's seed and preliminary draws for the default example.
np.random.seed(1)
first_round = flip(n, p)
seq = flip(1000, p)
results_sim = [simulate_round(n, p) for _ in range(1000)]
ks = np.arange(n + 1)
pmf_model = Pmf(binomial_pmf(ks, n, p), ks, name="binomial model")
pmf_sim = Pmf.from_seq(results_sim, name="simulation")
print("첫 라운드:", first_round)
print(f"한 번의 시도에서 관측한 명중 비율: {seq.mean():.6f}")
print(f"이론 평균: {n*p:.6f}회")
print(f"시뮬레이션 평균: {np.mean(results_sim):.6f}회")
print(f"이론 분산: {n*p*(1-p):.6f}")
print(f"이론 PMF의 합: {pmf_model.sum():.12f}")
pmf_sim.bar(align="edge", width=-0.4)
pmf_model.bar(align="edge", width=0.4, alpha=0.5)
plt.xlabel("Hits")
plt.ylabel("PMF")
plt.legend()
plt.tight_layout()
plt.show()

# Add your own analysis here; results_sim and pmf_model are available.
