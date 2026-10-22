/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Tree, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedValues: FigureInputs["tree"]["values"] = [50, 30, 70, 20, 40, 60, 80, 35, 65, 10, 90];

const sharedValues1: FigureInputs["tree"]["values"] = [10, 20, 30, 35, 40, 50, 60, 65, 70, 80, 90];

const shuffledBSTData = {
	operation: "bst-insert",
	title: "Mixed input",
	values: sharedValues,
	step: 0.11
} satisfies FigureInputs["tree"];

const sortedBSTData = {
	operation: "bst-insert",
	title: "Sorted input",
	values: sharedValues1,
	step: 0.11
} satisfies FigureInputs["tree"];

const searchBSTData = {
	operation: "bst-search",
	title: "Search for 65",
	values: sharedValues,
	target: 65
} satisfies FigureInputs["tree"];

const sortedHeapData = {
	operation: "heap-insert",
	title: "Max heap · sorted input",
	values: sharedValues1
} satisfies FigureInputs["tree"];

export function ShuffledBST(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={shuffledBSTData} caption="Mixed insertion order produces a branching tree with height four." {...input} />;
}

export function SortedBST(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={sortedBSTData} caption="Sorted insertions attach every value to the right, turning the tree into a chain." {...input} />;
}

export function SearchBST(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={searchBSTData} caption="Searching for 65 follows just one path down from the root." {...input} />;
}

export function SortedHeap(input: Partial<DiagramProps<"tree">>) {
	return <Tree props={sortedHeapData} caption="The heap retains height four; larger insertions swap with their parents towards the root." {...input} />;
}
