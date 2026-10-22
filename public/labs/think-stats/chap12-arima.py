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

from statsmodels.tsa.arima.model import ARIMA

answer = (await read_input("AR 차수 (1 / 2 / 3, 기본 1): ")).strip()
p = int(answer or "1")
if p not in [1,2,3]:
    raise ValueError("1, 2, 3 중 하나를 입력하세요.")
horizon = 60
training,test = nuclear.iloc[:-horizon],nuclear.iloc[-horizon:]
# A smaller model than the book's sparse ARMA, suitable for the browser.
fit = ARIMA(training,order=(p,0,0),seasonal_order=(0,1,0,12)).fit()
forecast = fit.get_forecast(horizon)
predicted = forecast.predicted_mean
bounds = forecast.conf_int(alpha=0.05)
mape = np.mean(np.abs((test-predicted)/test))*100
print(f"SARIMA({p},0,0)(0,1,0,12), 훈련 종료 {training.index[-1]:%Y-%m}")
print(f"수렴 여부: {fit.mle_retvals['converged']}")
print(f"60개월 평가 MAPE: {mape:.6f}%")
print(f"첫 예측: {predicted.iloc[0]:.6f} GWh")
print(f"첫 95% 예측구간: [{bounds.iloc[0,0]:.6f}, {bounds.iloc[0,1]:.6f}] GWh")
print("미래 관측값의 모형 기반 예측구간입니다. 모형·구조 변화는 남습니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(test,label="test")
plt.plot(predicted,label="forecast")
plt.fill_between(test.index,bounds.iloc[:,0],bounds.iloc[:,1],alpha=0.2,label="95% prediction interval")
plt.xlabel("Month")
plt.ylabel("Nuclear generation (GWh)")
plt.legend()
plt.tight_layout()
plt.show()
