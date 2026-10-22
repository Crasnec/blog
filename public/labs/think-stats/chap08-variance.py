# Think Stats browser exercise (MIT). See README.txt.
import numpy as np

answer = (await read_input("표본 크기 (기본 5, 2~100): ")).strip()
n = int(answer or "5")
if not 2 <= n <= 100:
    raise ValueError("2~100의 정수를 입력하세요.")
mu, sigma = 3.7, 0.46
rng = np.random.default_rng(1)
samples = rng.normal(mu, sigma, size=(5001, n))
print(f"실제 모분산: {sigma**2:.6f} kg²")
print(f"ddof=0 분산 추정값의 평균: {samples.var(axis=1, ddof=0).mean():.6f} kg²")
print(f"ddof=0 추정량의 기댓값: {sigma**2*(n-1)/n:.6f} kg²")
print(f"ddof=1 분산 추정값의 평균: {samples.var(axis=1, ddof=1).mean():.6f} kg²")
print("독립이고 같은 분포에서 나온 표본, 유한한 모분산을 가정합니다.")
