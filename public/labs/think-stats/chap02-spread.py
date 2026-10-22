# Think Stats browser exercise (MIT). See README.txt.
import numpy as np

answer = (await read_input("퍼짐 배수 (기본 1, 0~10): ")).strip()
scale = float(answer or "1")
if not np.isfinite(scale) or not 0 <= scale <= 10:
    raise ValueError("0~10의 유한한 수를 입력하세요.")
a = np.array([2, 2, 2, 2, 2])
b = 2 + scale * np.array([-2, -1, 0, 1, 2])
for name, values in [("A", a), ("B", b)]:
    print(f"{name}: {values.tolist()}")
    print(f"  평균 {values.mean():.6f}, 중앙값 {np.median(values):.6f}")
    print(f"  분산 {values.var():.6f}, 표준편차 {values.std():.6f} (ddof=0)")
