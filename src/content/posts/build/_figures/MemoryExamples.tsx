/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Memory, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedRequests: FigureInputs["memory"]["requests"] = [
	{
		op: "alloc", id: "A", size: 5
	},
	{
		op: "alloc", id: "B", size: 4
	},
	{
		op: "alloc", id: "C", size: 3
	},
	{
		op: "free", id: "B"
	},
	{
		op: "alloc", id: "D", size: 5
	},
	{
		op: "free", id: "C"
	},
	{
		op: "alloc", id: "E", size: 8
	},
	{
		op: "free", id: "A"
	},
	{
		op: "alloc", id: "F", size: 6
	},
	{
		op: "alloc", id: "G", size: 9
	},
];

const firstFitAllocationData = {
	policy: "first-fit",
	heap: 32,
	requests: sharedRequests
} satisfies FigureInputs["memory"];

const bestFitAllocationData = {
	policy: "best-fit",
	heap: 32,
	requests: sharedRequests
} satisfies FigureInputs["memory"];

export function FirstFitAllocation(input: Partial<DiagramProps<"memory">>) {
	return <Memory props={firstFitAllocationData} caption="빈 공간은 13칸이 남았지만 가장 큰 빈 칸이 7칸이라, 9칸짜리 요청이 실패한다." {...input} />;
}

export function BestFitAllocation(input: Partial<DiagramProps<"memory">>) {
	return <Memory props={bestFitAllocationData} caption="F가 뒤쪽의 작은 빈 칸으로 가면서 앞쪽 12칸이 통째로 남고, 9칸짜리 요청도 들어간다." {...input} />;
}
