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

from scipy.stats import norm

choice = (await read_input("아델리 집단 (all / male / female, 기본 all): ")).strip() or "all"
if choice not in ["all","male","female"]:
    raise ValueError("all, male, female 중 하나를 입력하세요.")
values = adelie["mass"].to_numpy() if choice == "all" else adelie.loc[adelie["Sex"]==choice.upper(),"mass"].to_numpy()
ps = (np.arange(min(300,len(values)))+0.5)/min(300,len(values))
reference = norm.ppf(ps,loc=values.mean(),scale=values.std(ddof=1))
observed = np.quantile(values,ps)
print(f"관측 수: {len(values)}, 평균: {values.mean():.6f} g")
print(f"표본 표준편차 (ddof=1): {values.std(ddof=1):.6f} g")
print("같은 단위의 정규 기준 분위수와 관측 분위수를 비교합니다.")
print("직선에 가까운 모양은 정규 근사의 단서이며, 정규성의 증명은 아닙니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.scatter(reference,observed,s=10)
limits = [min(reference.min(),observed.min()),max(reference.max(),observed.max())]
plt.plot(limits,limits,color="gray",ls=":")
plt.xlabel("Fitted normal quantile (g)")
plt.ylabel("Empirical quantile (g)")
plt.tight_layout()
plt.show()
