/** Reproducible example inputs, shared by the gallery and regression tests. */
import { mean, normal, random } from "../../../../figures/kit.ts";
import { variance } from "../../../../figures/statistics/math.ts";
import type { FigureInputs, FigureKindName, ScoredObservation } from "../../../../figures/inputs.ts";

export type StatisticsCategory = "distribution" | "relationship" | "estimate" | "diagnostic" | "prediction";
type StatisticsKind = Exclude<FigureKindName, "line" | "distribution" | "flow" | "sequence" | "state-machine" | "sort" | "grid-search" | "hash-ring" | "tree" | "gantt" | "heatmap" | "memory" | "queue">;
export type StatisticsExample = {
	[K in StatisticsKind]: {
		kind: K; title: string; caption: string; category: StatisticsCategory;
		props: FigureInputs[K];
	}
}[StatisticsKind];

const rand = random(729);
const round = (value: number) => Math.round(value * 1000) / 1000;
const groups = [
	{ label: "A", values: Array.from({ length: 40 }, () => round(normal(rand))) },
	{ label: "B", values: Array.from({ length: 40 }, () => round(1.2 + normal(rand) * 1.3)) },
	{ label: "C", values: Array.from({ length: 40 }, (_, i) => round((i % 2 === 0 ? -1.4 : 2.5) + normal(rand) * 0.45)) },
];
const xy = Array.from({ length: 60 }, (_, i) => ({ x: round(i / 8), y: round(0.7 * i / 8 + normal(rand) * 0.9) }));
const clouds = Array.from({ length: 160 }, (_, i) => ({ x: round((i % 2 ? 1.8 : -1.4) + normal(rand) * 0.65), y: round((i % 2 ? 1 : -1) + normal(rand) * 0.75) }));
const diagnosticPoints = [...xy, { x: 10, y: 14 }];
const estimates = groups.map((g) => {
	const estimate = mean(g.values);
	const margin = 1.95996398454 * Math.sqrt(variance(g.values) / g.values.length);
	return { label: g.label, estimate, low: estimate - margin, high: estimate + margin };
});
const studies = [0.35, 0.7, 0.2, 0.5, 0.45].map((estimate, i) => {
	const se = 0.1 + i * 0.025;
	return { label: `Study ${String(i + 1)}`, estimate, low: estimate - 1.96 * se, high: estimate + 1.96 * se, weight: 1 / (se * se) };
});
const totalWeight = studies.reduce((a, s) => a + s.weight, 0);
const pooled = studies.reduce((a, s) => a + s.estimate * s.weight, 0) / totalWeight;
const series: number[] = [];
for (let i = 0; i < 96; i++) series.push(round(0.72 * (series.at(-1) ?? 0) + normal(rand) * 0.7));
const scored: ScoredObservation[] = Array.from({ length: 140 }, () => {
	const score = round(0.01 + rand() * 0.98);
	return { score, label: rand() < score ? 1 : 0 };
});
scored.push({ score: 0, label: 0 }, { score: 1, label: 1 });
const survival = [8, 13].map((scale, i) => ({
	label: i === 0 ? "A" : "B",
	observations: Array.from({ length: 30 }, () => {
		const eventTime = -Math.log(Math.max(1e-9, rand())) * scale;
		const censorTime = 8 + rand() * 12;
		return { time: round(Math.min(eventTime, censorTime)), event: eventTime <= censorTime };
	}),
}));

export const statisticsExamples: StatisticsExample[] = [
	{ kind: "scatter", title: "산점도", category: "relationship", caption: "점은 원자료이고, 직선은 그 점들에 적합한 최소제곱 회귀선이다.", props: { points: xy, fit: true } },
	{ kind: "boxplot", title: "박스플롯", category: "distribution", caption: "상자는 중앙 50%, 수염은 1.5 IQR 안의 관측값까지이며 바깥 값은 점으로 남는다.", props: { groups } },
	{ kind: "violin", title: "바이올린 플롯", category: "distribution", caption: "C는 봉우리가 두 개다. 각 바이올린의 최대 폭은 같으므로 높이가 아닌 윤곽을 비교한다.", props: { groups } },
	{ kind: "ecdf", title: "경험적 누적분포", category: "distribution", caption: "어떤 값 이하의 관측 비율을 읽는다. 동점은 한 번에 누적된다.", props: { groups } },
	{ kind: "qq", title: "Q–Q 플롯", category: "distribution", caption: "A 표본의 분위수를 표본 평균과 표준편차로 적합한 정규분포의 분위수와 비교한다.", props: { samples: groups[0]?.values ?? [] } },
	{ kind: "interval", title: "점추정치와 신뢰구간", category: "estimate", caption: "세 그룹의 표본 평균과 정규근사 95% 신뢰구간이다. 도표는 전달한 구간을 그대로 그린다.", props: { estimates, xLabel: "mean · normal-approx. 95% CI" } },
	{ kind: "kde", title: "커널 밀도 추정", category: "distribution", caption: "각 표본에 가우스 커널을 놓아 더한 밀도다. 대역폭이 평활화 정도를 정한다.", props: { groups } },
	{ kind: "beeswarm", title: "비스웜 플롯", category: "distribution", caption: "점의 세로 위치는 실제 값이고, 가로 위치는 겹침을 줄이기 위한 배치다.", props: { groups } },
	{ kind: "raincloud", title: "레인클라우드 플롯", category: "distribution", caption: "반쪽 밀도, 상자, 개별 관측값을 함께 읽는다.", props: { groups } },
	{ kind: "boxen", title: "박슨 플롯", category: "distribution", caption: "중첩된 상자가 중앙 50% 바깥의 분위수 구간을 점점 좁은 폭으로 보여 준다.", props: { groups } },
	{ kind: "ridgeline", title: "리지라인 플롯", category: "distribution", caption: "같은 값 축 위에서 그룹별 분포 형태를 비교한다. 각 곡선의 봉우리는 같은 높이로 정규화했다.", props: { groups } },
	{ kind: "pp", title: "P–P 플롯", category: "distribution", caption: "A와 B의 누적확률을 같은 관측값에서 대응시킨다. 대각선에서 벗어나는 정도를 본다.", props: { samples: groups[0]?.values ?? [], reference: groups[1]?.values ?? [] } },
	{ kind: "hexbin", title: "헥스빈 플롯", category: "relationship", caption: "점을 고정된 육각 격자에 모았다. 진한 칸에 관측값이 더 많다.", props: { points: clouds, bins: 12 } },
	{ kind: "density-contour", title: "2차원 밀도 등고선", category: "relationship", caption: "선은 최대 추정 밀도의 15·35·60·85% 높이다. 확률 질량이나 신뢰구간의 백분율이 아니다.", props: { points: clouds } },
	{ kind: "pairplot", title: "산점도 행렬", category: "relationship", caption: "각 칸은 변수 한 쌍이고, 대각선에는 해당 변수의 히스토그램을 놓았다.", props: { columns: ["x", "y", "z"], rows: xy.map((p) => [p.x, p.y, round(normal(rand) * 2)]) } },
	{ kind: "jointplot", title: "주변분포 결합 플롯", category: "relationship", caption: "위쪽 히스토그램은 x, 오른쪽 히스토그램은 y를 같은 축으로 집계한다.", props: { points: clouds } },
	{ kind: "forest", title: "포리스트 플롯", category: "estimate", caption: "사각형 넓이는 역분산 가중치, 마름모는 독립된 정규 추정량을 가정한 고정효과 통합 구간이다.", props: { estimates: studies, pooled: { label: "Pooled", estimate: pooled, low: pooled - 1.96 / Math.sqrt(totalWeight), high: pooled + 1.96 / Math.sqrt(totalWeight) } } },
	{ kind: "funnel", title: "퍼널 플롯", category: "estimate", caption: "위쪽일수록 표준오차가 작다. 점선은 중심 추정치 ± 1.96 × 표준오차이며, 비대칭만으로 편향을 확정하지 않는다.", props: { studies: Array.from({ length: 35 }, () => { const se = 0.08 + rand() * 0.55; return { estimate: 0.4 + normal(rand) * se, se }; }) } },
	{ kind: "bland-altman", title: "Bland–Altman 플롯", category: "relationship", caption: "두 측정의 차이를 평균에 대응시킨다. 점선은 평균 차이와 정규근사 95% 일치 한계이며 평균의 신뢰구간이 아니다.", props: { points: xy.map((p) => ({ x: 10 + p.x, y: 11.5 + 1.05 * p.x + normal(rand) * 0.7 })) } },
	{ kind: "mosaic", title: "모자이크 플롯", category: "estimate", caption: "칸의 넓이가 빈도에 비례한다. 색은 독립 가정에 대한 Pearson 잔차의 부호와 크기다.", props: { rows: ["A", "B", "C"], cols: ["X", "Y", "Z"], counts: [[35, 12, 8], [14, 30, 16], [6, 18, 31]] } },
	{ kind: "residual", title: "잔차 플롯", category: "diagnostic", caption: "원자료에 적합한 단순 선형회귀의 예측값과 잔차를 대응시킨다.", props: { points: diagnosticPoints } },
	{ kind: "scale-location", title: "Scale–Location 플롯", category: "diagnostic", caption: "내부 표준화 잔차의 절댓값에 제곱근을 취했다. 예측값에 따른 산포 변화를 살핀다.", props: { points: diagnosticPoints } },
	{ kind: "influence", title: "영향력 플롯", category: "diagnostic", caption: "가로는 레버리지, 세로는 표준화 잔차, 점 넓이는 Cook 거리다. 빨간 점은 4/n 기준을 넘는다.", props: { points: diagnosticPoints } },
	{ kind: "acf", title: "자기상관", category: "diagnostic", caption: "시차 1부터 표시한다. 점선은 백색잡음 가정의 근사 95% 기준이며 모든 시계열에 적용되는 신뢰구간은 아니다.", props: { values: series, lags: 12 } },
	{ kind: "pacf", title: "부분자기상관", category: "diagnostic", caption: "같은 시계열의 Yule–Walker 부분자기상관이다. 시차가 짧을 때의 직접적인 관계를 비교한다.", props: { values: series, lags: 12 } },
	{ kind: "lag", title: "시차 산점도", category: "diagnostic", caption: "각 점은 연속한 두 관측값이다. 같은 값 범위를 가로·세로 축에 사용한다.", props: { values: series, lag: 1 } },
	{ kind: "kaplan-meier", title: "Kaplan–Meier 생존곡선", category: "prediction", caption: "사건에서만 곡선이 내려가고 중도절단은 눈금으로 남는다. 띠는 log-log Greenwood 95% 구간이다.", props: { groups: survival } },
	{ kind: "roc", title: "ROC 곡선", category: "prediction", caption: "점수가 같은 관측값을 함께 넘기며 거짓양성률과 참양성률을 계산한다.", props: { data: scored } },
	{ kind: "precision-recall", title: "정밀도–재현율 곡선", category: "prediction", caption: "계단의 넓이는 average precision이다. 수평 점선은 실제 양성 비율이다.", props: { data: scored } },
	{ kind: "calibration", title: "확률 보정 곡선", category: "prediction", caption: "빈 구간은 생략하고, 각 구간의 평균 예측확률과 실제 양성 비율을 대응시킨다. 점 크기는 관측 수를 반영한다.", props: { data: scored, bins: 8 } },
];
