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

import statsmodels.formula.api as smf

choice = (await read_input("나이 모형 (linear / quadratic, 기본 linear): ")).strip() or "linear"
if choice not in ["linear","quadratic"]:
    raise ValueError("linear 또는 quadratic을 입력하세요.")
valid = live.dropna(subset=["totalwgt_lb","birthord","agepreg"]).copy()
valid["is_first"] = valid["birthord"] == 1
base = smf.ols("totalwgt_lb ~ C(is_first)",data=valid).fit()
formula = "totalwgt_lb ~ C(is_first) + agepreg"
if choice == "quadratic":
    formula += " + I(agepreg**2)"
fit = smf.ols(formula,data=valid).fit()
key = "C(is_first)[T.True]"
lo, hi = fit.conf_int().loc[key]
print(f"사용한 출산 기록 수: {int(fit.nobs)}")
print(f"조정 전 첫아이 계수: {base.params[key]:.6f} lb")
print(f"나이 조정 뒤 계수: {fit.params[key]:.6f} lb")
print(f"95% 구간: [{lo:.6f}, {hi:.6f}] lb")
print(f"p값: {fit.pvalues[key]:.6f}, 훈련 R²: {fit.rsquared:.6f}")
print("관찰 자료의 모형 조정이며, 인과효과를 입증하지 않습니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.errorbar([0,1],[base.params[key],fit.params[key]],
             yerr=np.array([[base.params[key]-base.conf_int().loc[key,0],fit.params[key]-lo],
                            [base.conf_int().loc[key,1]-base.params[key],hi-fit.params[key]]]),fmt="o")
plt.xticks([0,1],["Unadjusted",choice])
plt.axhline(0,color="gray",ls=":")
plt.ylabel("First-birth coefficient (lb)")
plt.tight_layout()
plt.show()
