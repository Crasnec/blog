/** Different domains exercise the same reusable diagram components. */
import { Line, Distribution, Sort, Heatmap, HashRing, GridSearch } from "../../../../components/figures";

const measurements = [-4, -1, 2, 0, -2, 3];

export function SignedLine() {
	return <Line props={{
		series: [
			{
				label: "편차", values: measurements
			}
		], unit: "기준 대비 차이"
	}} caption="음수와 양수를 같은 축에 표시한다." />;
}

export function SignedDistribution() {
	return <Distribution props={{
		groups: [
			{
				label: "편차", samples: measurements
			}
		], markers: [50]
	}} caption="분포의 값 축도 음수부터 자동으로 맞춘다." />;
}

export function SignedSort() {
	return <Sort props={{
		algorithm: "merge", values: measurements
	}} caption="0을 기준으로 위·아래에 놓인 값을 같은 정렬 알고리즘으로 비교한다." />;
}

export function ConstantSort() {
	return <Sort props={{
		algorithm: "quick", values: [0, 0, 0, 0]
	}} caption="모든 값이 0이어도 비교 과정과 최종 상태가 남는다." />;
}

export function ConstantHeatmap() {
	return <Heatmap props={{
		rows: ["제어군", "실험군"], cols: ["1차", "2차", "3차"], values: [[-2, -2, -2], [-2, -2, -2]], highlight: 0
	}} caption="값이 모두 같은 행렬도 유효한 입력이다. 자동 색 범위는 그 값을 중심으로 잡는다." />;
}

export function NamedKeys() {
	return <HashRing props={{
		scheme: "modulo", servers: ["node-a", "node-b"], add: "node-c", keys: ["user:42", "order:7", "cache:9", "user:108"]
	}} caption="예제용 키 개수 대신 실제 문자열을 해시해 서버 배정을 계산한다." />;
}

export function UnreachableMaze() {
	return <GridSearch props={{ algorithm: "bfs", maze: ["S#G", "###", "..."] }} caption="출발점에서 갈 수 있는 칸을 모두 확인한 뒤, 경로가 없다는 결과를 남긴다." />;
}
