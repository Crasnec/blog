# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

response = await pyfetch("/labs/think-stats/lamps.csv")
if not response.ok:
    raise RuntimeError(f"Data download failed: {response.status}")
with open("lamps.csv","wb") as stream:
    stream.write(await response.bytes())
lamps = pd.read_csv("lamps.csv")
original = np.repeat(lamps["h"].to_numpy(),lamps["f"].to_numpy(dtype=np.intp))
answer = (await read_input("관측을 끝낼 시간 (기본 1700, 900~2600시간): ")).strip()
limit = float(answer or "1700")
if not np.isfinite(limit) or not 900 <= limit <= 2600:
    raise ValueError("900~2600시간의 유한한 수를 입력하세요.")
times = np.minimum(original,limit)
events = original <= limit
def kaplan_meier(times, events):
    times, events = np.asarray(times, float), np.asarray(events, bool)
    if len(times) == 0 or not np.isfinite(times).all() or np.any(times < 0):
        raise ValueError("At least one finite, nonnegative observation is required.")
    rows = [(0.0, len(times), 0, 0, 1.0, 1.0, 1.0)]
    survival, greenwood = 1.0, 0.0
    for t in np.unique(times):
        risk = int(np.sum(times >= t))
        deaths = int(np.sum((times == t) & events))
        censored = int(np.sum((times == t) & ~events))
        survival *= 1 - deaths/risk
        if 0 < survival < 1:
            greenwood += deaths/(risk*(risk-deaths))
            center = np.log(-np.log(survival))
            se = np.sqrt(greenwood)/abs(np.log(survival))
            low = np.exp(-np.exp(center + 1.959963984540054*se))
            high = np.exp(-np.exp(center - 1.959963984540054*se))
        else:
            low = high = survival
        rows.append((float(t), risk, deaths, censored, survival, low, high))
    return np.array(rows)


def survival_at(rows, t):
    return float(rows[np.searchsorted(rows[:,0], t, side="right")-1, 4])

rows = kaplan_meier(times,events)
completed_only = original[events]
print(f"전체 전구: {len(times)}, 사건 관측: {events.sum()}, 중도절단: {(~events).sum()}")
query = min(1656,limit)
print(f"{query:g}시간 이후 생존확률 (KM): {survival_at(rows,query):.6f}")
print(f"완료 사례만 쓴 잘못된 생존비율: {np.mean(completed_only>query):.6f}")
print("중도절단은 실패 사건이 아닙니다. 관측 종료 이후는 추정하지 않습니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.step(rows[:,0],rows[:,4],where="post",label="Kaplan-Meier")
plt.fill_between(rows[:,0],rows[:,5],rows[:,6],step="post",alpha=0.2,label="95% pointwise interval")
plt.plot(times[~events],np.full((~events).sum(),rows[-1,4]),"+",color="gray")
plt.xlabel("Hours")
plt.ylabel("Survival probability")
plt.ylim(0,1.05)
plt.legend()
plt.tight_layout()
plt.show()
