/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Memory, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedRequests: FigureInputs["memory"]["requests"] = [
    {
        op: "alloc",
        id: "A",
        size: 5,
    },
    {
        op: "alloc",
        id: "B",
        size: 4,
    },
    {
        op: "alloc",
        id: "C",
        size: 3,
    },
    {
        op: "free",
        id: "B",
    },
    {
        op: "alloc",
        id: "D",
        size: 5,
    },
    {
        op: "free",
        id: "C",
    },
    {
        op: "alloc",
        id: "E",
        size: 8,
    },
    {
        op: "free",
        id: "A",
    },
    {
        op: "alloc",
        id: "F",
        size: 6,
    },
    {
        op: "alloc",
        id: "G",
        size: 9,
    },
];

const firstFitAllocationData = {
    policy: "first-fit",
    heap: 32,
    requests: sharedRequests,
} satisfies FigureInputs["memory"];

const bestFitAllocationData = {
    policy: "best-fit",
    heap: 32,
    requests: sharedRequests,
} satisfies FigureInputs["memory"];

export function FirstFitAllocation(input: Partial<DiagramProps<"memory">>) {
    return (
        <Memory
            props={firstFitAllocationData}
            caption="Thirteen cells are free, but the largest region has seven; a nine-cell request fails."
            {...input}
        />
    );
}

export function BestFitAllocation(input: Partial<DiagramProps<"memory">>) {
    return (
        <Memory
            props={bestFitAllocationData}
            caption="Placing F in the smaller rear region preserves twelve contiguous cells for the nine-cell request."
            {...input}
        />
    );
}
