/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Sort, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";
import { numberSamples } from "../../../../figures/generators";

const sortValues = numberSamples(16, {
	seed: 3, min: 1, max: 99, integer: true
});

const bubbleSortData = {
	algorithm: "bubble",
	step: 0.03,
	values: sortValues
} satisfies FigureInputs["sort"];

const quickSortData = {
	algorithm: "quick",
	step: 0.03,
	values: sortValues
} satisfies FigureInputs["sort"];

export function BubbleSort(input: Partial<DiagramProps<"sort">>) {
	return <Sort props={bubbleSortData} caption="한 바퀴마다 가장 큰 값 하나가 끝으로 밀려나며 자리를 잡는다." {...input} />;
}

export function QuickSort(input: Partial<DiagramProps<"sort">>) {
	return <Sort props={quickSortData} caption="같은 입력인데 비교 횟수가 훨씬 적어서, 같은 속도로 재생해도 먼저 끝난다." {...input} />;
}
