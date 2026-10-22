# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

response = await pyfetch("/labs/think-stats/Net_generation_for_all_sectors.csv")
if not response.ok:
    raise RuntimeError(f"Data download failed: {response.status}")
with open("electricity.csv", "wb") as stream:
    stream.write(await response.bytes())
elec = (pd.read_csv("electricity.csv", skiprows=4)
        .drop(columns=["units", "source key"]).set_index("description")
        .replace("--", np.nan).T.astype(float))
elec.index = pd.date_range("2001-01-31", periods=len(elec), freq="ME")
nuclear = elec["United States : nuclear"].dropna()

from statsmodels.tsa.seasonal import seasonal_decompose

choice = (await read_input("전원 (nuclear / solar, 기본 nuclear): ")).strip() or "nuclear"
if choice not in ["nuclear","solar"]:
    raise ValueError("nuclear 또는 solar를 입력하세요.")
series = nuclear if choice == "nuclear" else elec["United States : small-scale solar photovoltaic"].dropna()
mode = "additive" if choice == "nuclear" else "multiplicative"
parts = seasonal_decompose(series,model=mode,period=12)
expected = parts.trend+parts.seasonal if mode == "additive" else parts.trend*parts.seasonal
mask = expected.notna()
r2 = 1-np.var((series-expected)[mask])/np.var(series[mask])
print(f"{series.index[0]:%Y-%m}~{series.index[-1]:%Y-%m}, {len(series)}개월")
print(f"분해: {mode}, 계절 주기 12개월")
print(f"성분을 평가할 수 있는 구간의 R²: {r2:.6f}")
print("미래 예측 성능이 아니라 같은 자료를 분해한 적합도입니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

parts.plot()
plt.tight_layout()
plt.show()
