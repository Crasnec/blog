/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Sort, type DiagramProps } from "#src/components/figures/index.tsx";
import type { FigureInputs } from "#src/figures/inputs.ts";
import { numberSamples } from "#src/figures/generators.ts";

const sortValues = numberSamples(16, {
    seed: 3,
    min: 1,
    max: 99,
    integer: true,
});

const bubbleSortData = {
    algorithm: "bubble",
    step: 0.03,
    values: sortValues,
} satisfies FigureInputs["sort"];

const quickSortData = {
    algorithm: "quick",
    step: 0.03,
    values: sortValues,
} satisfies FigureInputs["sort"];

export function BubbleSort(input: Partial<DiagramProps<"sort">>) {
    return (
        <Sort
            props={bubbleSortData}
            caption="Each pass moves the largest remaining value into its final position."
            {...input}
        />
    );
}

export function QuickSort(input: Partial<DiagramProps<"sort">>) {
    return (
        <Sort
            props={quickSortData}
            caption="Fewer comparisons on the same input produce an earlier finish at the same playback rate."
            {...input}
        />
    );
}
