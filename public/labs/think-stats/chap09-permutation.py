# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

# Browser-only preparation: fetch the same NSFG files from this site.
for filename in ["2002FemPreg.dct", "2002FemPreg.dat.gz"]:
    response = await pyfetch("/labs/think-stats/" + filename)
    if not response.ok:
        raise RuntimeError(f"Could not read {filename}: HTTP {response.status}")
    with open(filename, "wb") as stream:
        stream.write(await response.bytes())

dct_file = "2002FemPreg.dct"
dat_file = "2002FemPreg.dat.gz"

from statadict import parse_stata_dict


def read_stata(dct_file, dat_file):
    stata_dict = parse_stata_dict(dct_file)
    resp = pd.read_fwf(
        dat_file,
        names=stata_dict.names,
        colspecs=stata_dict.colspecs,
        compression="gzip",
    )
    return resp

# Consolidate pandas blocks before adding the derived weight column.
preg = read_stata(dct_file, dat_file).copy()
preg["birthwgt_lb"] = preg["birthwgt_lb"].replace([51, 97, 98, 99], np.nan)
preg["birthwgt_oz"] = preg["birthwgt_oz"].replace([97, 98, 99], np.nan)
preg["agepreg"] /= 100
preg["totalwgt_lb"] = preg["birthwgt_lb"] + preg["birthwgt_oz"] / 16
live = preg.query("outcome == 1").copy()

kind = (await read_input("통계량 (mean / std, 기본 mean): ")).strip() or "mean"
answer = (await read_input("순열 반복 수 (기본 1001, 99~2001): ")).strip()
repeats = int(answer or "1001")
if kind not in ["mean", "std"] or not 99 <= repeats <= 2001:
    raise ValueError("mean 또는 std, 반복 수 99~2001을 입력하세요.")
a = live.query("birthord == 1")["prglngth"].to_numpy()
b = live.query("birthord != 1")["prglngth"].to_numpy()
measure = np.mean if kind == "mean" else np.std
observed = abs(measure(a)-measure(b))
pool = np.concatenate([a,b])
rng = np.random.default_rng(1)
stats = np.empty(repeats)
for i in range(repeats):
    shuffled = rng.permutation(pool)
    stats[i] = abs(measure(shuffled[:len(a)])-measure(shuffled[len(a):]))
count = int(np.sum(stats >= observed))
p_value = (count+1)/(repeats+1)
print("첫아이 / 다른 아이 수:", len(a), len(b))
print(f"관측 통계량 ({kind} 차이의 절댓값): {observed:.6f}주")
print(f"관측값 이상의 순열 결과: {count}/{repeats}")
print(f"Monte Carlo p값 (+1 보정): {p_value:.6f}")
print("같은 분포와 관측의 교환 가능성을 가정합니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.hist(stats, bins=30, density=True, alpha=0.5)
plt.axvline(observed, color="gray", ls=":")
plt.xlabel(f"Absolute difference ({kind}, weeks)")
plt.ylabel("Density")
plt.tight_layout()
plt.show()
