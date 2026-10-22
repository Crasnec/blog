# Think Stats browser exercise (MIT). See README.txt.
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import linregress

answer = (await read_input("절편을 옮길 거리 (기본 0, -5~5): ")).strip()
offset = float(answer or "0")
if not np.isfinite(offset) or not -5 <= offset <= 5:
    raise ValueError("-5~5의 유한한 수를 입력하세요.")
x = np.array([1,2,3,4,5])
y = np.array([2,3,5,4,6])
fit = linregress(x,y)
fitted = fit.intercept+fit.slope*x
base_mse = np.mean((y-fitted)**2)
changed_mse = np.mean((y-fitted-offset)**2)
print(f"최소제곱 기울기: {fit.slope:.6f}, 절편: {fit.intercept:.6f}")
print(f"최소 MSE: {base_mse:.6f}")
print(f"옮긴 직선의 MSE: {changed_mse:.6f}")
print(f"MSE 증가량: {changed_mse-base_mse:.6f} = offset²")
deltas = np.linspace(-5,5,201)
mses = base_mse+deltas**2
# Compatibility with the current Pyodide Agg renderer.
import warnings
from matplotlib import MatplotlibDeprecationWarning
warnings.filterwarnings(
    "ignore",
    message=r"The [xy] parameter as float was deprecated in Matplotlib 3\.10.*Use int\([xy]\) instead\.",
    category=MatplotlibDeprecationWarning,
)

plt.plot(deltas,mses)
plt.plot(offset,changed_mse,"o")
plt.xlabel("Intercept offset")
plt.ylabel("MSE")
plt.tight_layout()
plt.show()
