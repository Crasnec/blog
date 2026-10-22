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

species = (await read_input("종 (Adelie / Gentoo, 기본 Adelie): ")).strip() or "Adelie"
answer = (await read_input("설명변수 수 (1 / 4, 기본 1): ")).strip()
count = int(answer or "1")
if species not in ["Adelie","Gentoo"] or count not in [1,4]:
    raise ValueError("Adelie 또는 Gentoo, 설명변수 수 1 또는 4를 입력하세요.")
columns = ["mass","flipper_length","culmen_length","culmen_depth"]
df = penguins[penguins["Species"].str.startswith(species) & penguins["Sex"].isin(["MALE","FEMALE"])].dropna(subset=columns).copy()
df["y"] = (df["Sex"] == "MALE").astype(int)
formula = "y ~ mass" if count == 1 else "y ~ " + " + ".join(columns)
fit = smf.logit(formula,data=df).fit(disp=False)
masses = np.linspace(df["mass"].min(),df["mass"].max(),201)
new = pd.DataFrame({c:np.full(len(masses),df[c].mean()) for c in columns})
new["mass"] = masses
probs = fit.predict(new)
print(f"알려진 성별만 사용한 관측 수: {len(df)}")
print(f"McFadden 유사 R²: {fit.prsquared:.6f}")
print("계수:")
print(fit.params.to_string())
print("유사 R²는 설명된 분산의 비율이나 분류 정확도가 아닙니다.")
print("다른 측정값은 이 종의 평균으로 고정한 예측입니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(masses,probs)
plt.axhline(0.5,color="gray",ls=":")
plt.xlabel("Mass (g)")
plt.ylabel("P(male)")
plt.ylim(0,1)
plt.tight_layout()
plt.show()
