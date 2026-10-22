# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

response = await pyfetch("/labs/think-stats/penguins_raw.csv")
if not response.ok:
    raise RuntimeError(f"Data download failed: {response.status}")
with open("penguins_raw.csv", "wb") as stream:
    stream.write(await response.bytes())
penguins = pd.read_csv("penguins_raw.csv").rename(columns={
    "Body Mass (g)": "mass", "Flipper Length (mm)": "flipper_length",
    "Culmen Length (mm)": "culmen_length", "Culmen Depth (mm)": "culmen_depth",
})
adelie = penguins[penguins["Species"].str.startswith("Adelie")].dropna(subset=["mass"])

import statsmodels.formula.api as smf

answer = (await read_input("설명변수 수 (1 / 2 / 3, 기본 2): ")).strip()
count = int(answer or "2")
if count not in [1,2,3]:
    raise ValueError("1, 2, 3 중 하나를 입력하세요.")
variables = ["flipper_length","culmen_length","culmen_depth"][:count]
formula = "mass ~ " + " + ".join(variables)
fit = smf.ols(formula,data=adelie).fit()
print(formula)
print(f"관측 수: {int(fit.nobs)}, 훈련 R²: {fit.rsquared:.6f}")
print(pd.DataFrame({"coef":fit.params,"SE":fit.bse,"p":fit.pvalues}).to_string())
print("95% 구간:")
print(fit.conf_int().to_string())
print("각 기울기는 나머지 설명변수를 고정했을 때의 관계입니다.")
actual = adelie.loc[fit.model.data.row_labels,"mass"]
predicted = fit.fittedvalues
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.scatter(actual,predicted,s=12,alpha=0.4)
limits = [min(actual.min(),predicted.min()),max(actual.max(),predicted.max())]
plt.plot(limits,limits,ls=":",color="gray")
plt.xlabel("Observed mass (g)")
plt.ylabel("Fitted mass (g)")
plt.tight_layout()
plt.show()
