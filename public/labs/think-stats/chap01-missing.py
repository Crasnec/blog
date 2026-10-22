# Think Stats browser exercise (MIT). See README.txt.
import numpy as np
import pandas as pd

answer = (await read_input("마지막 체중 값 (기본 99, 99는 무응답 코드): ")).strip()
last = float(answer or "99")
if not np.isfinite(last) or not 0 <= last <= 100:
    raise ValueError("0~100의 유한한 수를 입력하세요.")
raw = pd.Series([6.0, 7.0, 8.0, last])
clean = raw.replace(99, np.nan)
print("원자료:", raw.tolist())
print(f"정제 전 평균: {raw.mean():.6f} lb")
print("정제 후:", clean.tolist())
print(f"유효한 관측 수: {clean.count()}")
print(f"정제 후 평균: {clean.mean():.6f} lb")
