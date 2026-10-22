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

from scipy.stats import linregress

answer = (await read_input("예측할 날개 길이 (mm, 기본 190): ")).strip()
target = float(answer or "190")
x, y = adelie["flipper_length"].to_numpy(), adelie["mass"].to_numpy()
if not np.isfinite(target) or not x.min() <= target <= x.max():
    raise ValueError(f"관측 범위 {x.min():g}~{x.max():g}mm에서 입력하세요.")
fit = linregress(x,y)
fitted = fit.intercept + fit.slope*x
residuals = y-fitted
print("아델리펭귄 수:", len(x))
print(f"기울기: {fit.slope:.6f} g/mm, 절편: {fit.intercept:.6f} g")
print(f"R²: {fit.rvalue**2:.6f}")
print(f"회귀선 MSE: {np.mean(residuals**2):.6f} g²")
print(f"평균만 예측한 MSE: {np.var(y):.6f} g²")
print(f"{target:g}mm에서 예측 평균: {fit.intercept+fit.slope*target:.6f} g")
print("개체의 실제 체중에는 잔차 변동이 더 있습니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.scatter(x,y,s=12,alpha=0.4)
xs = np.linspace(x.min(),x.max(),101)
plt.plot(xs,fit.intercept+fit.slope*xs)
plt.xlabel("Flipper length (mm)")
plt.ylabel("Mass (g)")
plt.tight_layout()
plt.show()
