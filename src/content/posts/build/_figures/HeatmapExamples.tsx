/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Heatmap, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";
import { dailyPeak } from "../../../../figures/presets/daily-peak";

const rowLabels = ["월", "화", "수", "목", "금", "토", "일"];

const columnLabels = ["0시", "1시", "2시", "3시", "4시", "5시", "6시", "7시", "8시", "9시", "10시", "11시", "12시", "13시", "14시", "15시", "16시", "17시", "18시", "19시", "20시", "21시", "22시", "23시"];

const weeklyLatencyData = {
	rows: rowLabels,
	cols: columnLabels,
	values: dailyPeak({
		model: "daily-peak",
		base: 110,
		peak: 480,
		peakHour: 20,
		spread: 2.2,
		daytime: 0.3,
		weekend: ["토", "일"],
		spikes: [
			{
				row: "월", col: "9시", add: 650
			}
		],
		noise: 0.1,
		seed: 4,
	}, rowLabels, columnLabels, "example.values"),
	unit: "ms",
	highlight: 3
} satisfies FigureInputs["heatmap"];

export function WeeklyLatency(input: Partial<DiagramProps<"heatmap">>) {
	return <Heatmap props={weeklyLatencyData} caption="평일 저녁 8시 무렵마다 진한 세로 띠가 생기고, 그보다 더 진한 칸은 월요일 아침 9시 하나뿐이다." label="요일(행)과 시간(열)별 API p95 지연 히트맵. 평일 저녁 20시 전후가 진하고 주말은 옅으며, 월요일 9시 한 칸이 가장 진하다." {...input} />;
}
