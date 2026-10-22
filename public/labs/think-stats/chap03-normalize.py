# Think Stats browser exercise (MIT). See README.txt.
import numpy as np
from empiricaldist import Pmf

pmf = Pmf.from_seq([1, 2, 2, 3, 5])
answer = (await read_input("값 2의 새 가중치 (기본 0.8, 0~5): ")).strip()
weight = float(answer or "0.8")
if not np.isfinite(weight) or not 0 <= weight <= 5:
    raise ValueError("0~5의 유한한 수를 입력하세요.")
pmf[2] = weight
print(f"정규화 전 합: {pmf.sum():.6f}")
pmf.normalize()
print(pmf.to_string())
print(f"정규화 후 합: {pmf.sum():.6f}")
print(f"정규화 후 P(2): {pmf(2):.6f}")
