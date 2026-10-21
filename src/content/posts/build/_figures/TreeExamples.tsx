/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Tree, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedValues: FigureInputs["tree"]["values"] = [50, 30, 70, 20, 40, 60, 80, 35, 65, 10, 90];

const sharedValues1: FigureInputs["tree"]["values"] = [10, 20, 30, 35, 40, 50, 60, 65, 70, 80, 90];

const shuffledBSTData = {
	operation: "bst-insert",
	title: "섞인 순서",
	values: sharedValues,
	step: 0.11
} satisfies FigureInputs["tree"];

const sortedBSTData = {
	operation: "bst-insert",
	title: "정렬된 순서",
	values: sharedValues1,
	step: 0.11
} satisfies FigureInputs["tree"];

const searchBSTData = {
	operation: "bst-search",
	title: "65 찾기",
	values: sharedValues,
	target: 65
} satisfies FigureInputs["tree"];

const sortedHeapData = {
	operation: "heap-insert",
	title: "최대 힙 · 정렬된 순서",
	values: sharedValues1
} satisfies FigureInputs["tree"];

export function ShuffledBST(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={shuffledBSTData} caption="섞인 순서로 넣으면 트리가 좌우로 퍼져서 높이가 4에 그친다." {...input} />;
}

export function SortedBST(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={sortedBSTData} caption="정렬된 순서로 넣으면 모든 값이 오른쪽에만 붙어, 트리가 사실상 목록이 된다." {...input} />;
}

export function SearchBST(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={searchBSTData} caption="65를 찾을 때는 루트에서 내려가는 한 갈래만 확인한다." {...input} />;
}

export function SortedHeap(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={sortedHeapData} caption="정렬된 순서로 넣어도 높이는 4이고, 새 값은 부모와 자리를 바꾸며 맨 위까지 올라간다." {...input} />;
}
