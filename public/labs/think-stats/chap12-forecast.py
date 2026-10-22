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
import statsmodels.formula.api as smf

answer = (await read_input("끝에서 평가할 개월 수 (기본 60, 12~72): ")).strip()
horizon = int(answer or "60")
if not 12 <= horizon <= 72:
    raise ValueError("12~72의 정수를 입력하세요.")
training, test = nuclear.iloc[:-horizon],nuclear.iloc[-horizon:]
parts = seasonal_decompose(training,model="additive",period=12)
frame = pd.DataFrame({"trend":parts.trend,"months":np.arange(len(training))}).dropna()
fit = smf.ols("trend ~ months",data=frame).fit()
trend = fit.predict(pd.DataFrame({"months":np.arange(len(nuclear))}))
seasonal = parts.seasonal.groupby(parts.seasonal.index.month).mean()
predicted = pd.Series(trend.to_numpy()+seasonal.loc[nuclear.index.month].to_numpy(),index=nuclear.index)
mape = np.mean(np.abs((test-predicted.loc[test.index])/test))*100
print(f"훈련 종료: {training.index[-1]:%Y-%m}, 평가 기간: {horizon}개월")
print(f"평가 MAPE: {mape:.6f}%")
print("분해·추세·계절 평균은 훈련 구간에서만 추정했습니다.")
print("선형 증가 추세가 계속된다는 외삽 가정입니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(training,label="training",alpha=0.5)
plt.plot(test,label="test")
plt.plot(predicted.loc[test.index],label="forecast",ls=":")
plt.xlabel("Month")
plt.ylabel("Nuclear generation (GWh)")
plt.legend()
plt.tight_layout()
plt.show()
