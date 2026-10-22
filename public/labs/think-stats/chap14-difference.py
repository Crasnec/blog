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

from scipy.stats import norm,t

answer = (await read_input("신뢰수준 (기본 90, 50~99): ")).strip()
level = float(answer or "90")
if not np.isfinite(level) or not 50 <= level <= 99:
    raise ValueError("50~99의 유한한 수를 입력하세요.")
a = adelie.loc[adelie["Sex"]=="MALE","mass"].to_numpy()
b = adelie.loc[adelie["Sex"]=="FEMALE","mass"].to_numpy()
difference = a.mean()-b.mean()
v1,v2 = a.var(ddof=1)/len(a),b.var(ddof=1)/len(b)
se = np.sqrt(v1+v2)
df = (v1+v2)**2/(v1**2/(len(a)-1)+v2**2/(len(b)-1))
q = (1+level/100)/2
normal_ci = difference + norm.ppf(q)*se*np.array([-1,1])
welch_ci = difference + t.ppf(q,df)*se*np.array([-1,1])
rng = np.random.default_rng(1)
resampled = rng.choice(a,size=(1001,len(a))).mean(axis=1)-rng.choice(b,size=(1001,len(b))).mean(axis=1)
bootstrap_ci = np.percentile(resampled,[(100-level)/2,(100+level)/2])
print(f"수컷 / 암컷 관측 수: {len(a)} / {len(b)}")
print(f"평균 차이: {difference:.6f} g, 추정 SE: {se:.6f} g")
for name,ci in [("정규 근사",normal_ci),("Welch t",welch_ci),("부트스트랩 백분위",bootstrap_ci)]:
    print(f"{name} {level:g}% 구간: [{ci[0]:.6f}, {ci[1]:.6f}] g")
print("독립 두 집단과 유한한 분산을 가정합니다. 개체별 체중 차이의 범위가 아닙니다.")
for i,(name,ci) in enumerate([("Normal",normal_ci),("Welch",welch_ci),("Bootstrap",bootstrap_ci)]):
    plt.plot(ci,[i,i],"o-",label=name)
    plt.plot(difference,i,"o",color="gray")
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.yticks([0,1,2],["Normal","Welch","Bootstrap"])
plt.xlabel("Mean difference (g)")
plt.tight_layout()
plt.show()
