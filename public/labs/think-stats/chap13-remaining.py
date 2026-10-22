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

answer = (await read_input("시작한 임신 주 (기본 36, 36~43): ")).strip()
week = int(answer or "36")
if not 36 <= week <= 43:
    raise ValueError("36~43의 정수를 입력하세요.")
valid = live.dropna(subset=["prglngth","finalwgt"])
lengths = valid["prglngth"].to_numpy()
weights = valid["finalwgt"].to_numpy()
selected = lengths >= week
remaining = lengths[selected]-week
estimate = np.average(remaining,weights=weights[selected])
weeks = np.arange(36,44)
curve = np.array([np.average(lengths[lengths>=t]-t,weights=weights[lengths>=t]) for t in weeks])
print(f"{week}주 이상인 관측 수: {selected.sum()}")
print(f"가중 조건부 평균 잔여시간: {estimate:.6f}주")
print("원문의 가중 재표집 대신 표집가중치로 평균을 직접 계산했습니다.")
print("매주 조건에 들어가는 사례가 달라집니다. 개인의 분만 시점 예측이 아닙니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(weeks,curve,"o-")
plt.plot(week,estimate,"o")
plt.xlabel("Week beginning")
plt.ylabel("Weighted mean remaining weeks")
plt.tight_layout()
plt.show()
