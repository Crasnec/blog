# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

response = await pyfetch("/labs/think-stats/marriage_nsfg_female.csv.gz")
if not response.ok:
    raise RuntimeError(f"Data download failed: {response.status}")
with open("marriage.csv.gz","wb") as stream:
    stream.write(await response.bytes())
resp = pd.read_csv("marriage.csv.gz")
resp["cohort"] = ((1900+(resp["cmbirth"]-1)//12)//10*10).astype(int)
resp["agemarr"] = (resp["cmmarrhx"]-resp["cmbirth"])/12
resp["age"] = (resp["cmintvw"]-resp["cmbirth"])/12
answer = (await read_input("출생 코호트 (1950 / 1960 / 1970 / 1980, 기본 1960): ")).strip()
cohort = int(answer or "1960")
if cohort not in [1950,1960,1970,1980]:
    raise ValueError("1950, 1960, 1970, 1980 중 하나를 입력하세요.")
rng = np.random.RandomState(1)
resampled = pd.concat([group.sample(len(group),replace=True,weights="finalwgt",random_state=rng)
                        for _,group in resp.groupby("cycle")])
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

def cohort_survival(frame,cohort):
    group = frame[frame["cohort"] == cohort]
    complete = group.loc[group["evrmarry"] == True,"agemarr"].dropna().to_numpy()
    ongoing = group.loc[group["evrmarry"] == False,"age"].dropna().to_numpy()
    times = np.concatenate([complete,ongoing])
    events = np.concatenate([np.ones(len(complete),bool),np.zeros(len(ongoing),bool)])
    return kaplan_meier(times,events)

raw_rows = cohort_survival(resp,cohort)
rows = cohort_survival(resampled,cohort)
print(f"원자료: {len(resp)}명, 가중 재표집: {len(resampled)}명")
print(f"{cohort}년대생, 25세 이후 미혼확률 (무보정): {survival_at(raw_rows,25):.6f}")
print(f"{cohort}년대생, 25세 이후 미혼확률 (가중 재표집): {survival_at(rows,25):.6f}")
print("두 곡선 모두 중도절단을 처리합니다. 가중 재표집은 조사 주기별로 합니다.")
print("기본 Greenwood 구간은 복합표본 설계 구간이 아니므로 이 그림에는 표시하지 않습니다.")
print("추적 종료 때의 미혼확률은 평생 미혼확률이 아닙니다.")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.step(raw_rows[:,0],raw_rows[:,4],where="post",label="unweighted",alpha=0.5)
plt.step(rows[:,0],rows[:,4],where="post",label="weighted resample")
plt.xlabel("Age (years)")
plt.ylabel("P(not yet married)")
plt.ylim(0,1.05)
plt.legend()
plt.tight_layout()
plt.show()
