import { Area, Bar, Pie } from "../../../../components/figures";

const categories = ["Read", "Write", "Sync"];
const application = { label: "Application", values: [30, 18, 12] };
const series = [
    application,
    { label: "Kernel", values: [15, 12, 8] },
    { label: "Device", values: [5, 10, 20] },
];
const slices = series.map((s) => ({
    label: s.label,
    value: s.values.reduce((total, value) => total + value, 0),
}));
const workload = [
    { label: "Application", values: [10, 20, 15, 30, 20] },
    { label: "Kernel", values: [5, 8, 10, 12, 15] },
    { label: "Device", values: [2, 6, 4, 8, 10] },
];

export function VerticalBars() {
    return (
        <Bar
            props={{
                title: "Time per operation",
                categories,
                series: [application],
                unit: "ms",
                categoryLabel: "Operation",
                valueLabel: "Elapsed time",
            }}
            caption="Read takes 30 ms; write takes 18 ms; sync takes 12 ms."
        />
    );
}

export function HorizontalBars() {
    return (
        <Bar
            props={{
                title: "Change after tuning",
                orientation: "horizontal",
                unit: "ms",
                categories: [
                    "Sequential read",
                    "Random write",
                    "Background synchronization",
                    "Metadata",
                ],
                series: [{ label: "Change", values: [-12, 8, -4, 0] }],
                valueLabel: "After − before",
            }}
            caption="Negative changes mean less time. Metadata is unchanged at zero."
        />
    );
}

export function GroupedBars() {
    return (
        <Bar
            props={{
                title: "Compare components",
                categories,
                series,
                unit: "ms",
                categoryLabel: "Operation",
            }}
            caption="Grouped bars share a zero baseline, making component values easy to compare."
        />
    );
}

export function StackedBars() {
    return (
        <Bar
            props={{
                title: "Total time and its parts",
                categories,
                series,
                mode: "stacked",
                unit: "ms",
                categoryLabel: "Operation",
            }}
            caption="The totals are 50, 40 and 40 ms. The segments retain their original values."
        />
    );
}

export function PercentBars() {
    return (
        <Bar
            props={{
                title: "Share of each operation",
                categories,
                series,
                mode: "percent",
                orientation: "horizontal",
                unit: "ms",
            }}
            caption="Read is 60% application, 30% kernel and 10% device. Source data stays in ms."
        />
    );
}

export function PartToWhole() {
    return (
        <>
            <Pie
                props={{ title: "Time across all operations", slices, unit: "ms" }}
                caption="Application 60 ms, kernel 35 ms and device 35 ms: 130 ms in total."
            />
            <Pie
                props={{
                    title: "The same data as a donut",
                    slices,
                    variant: "donut",
                    totalLabel: "Total ms",
                    unit: "ms",
                }}
                caption="The center shows the total; the legend shows values and shares."
            />
        </>
    );
}

export function Areas() {
    return (
        <>
            <Area
                props={{
                    title: "Application workload",
                    x: [0, 1, 3, 4, 6],
                    series: [{ label: "Application", values: [10, 20, 15, 30, 20] }],
                    xLabel: "Elapsed time (s)",
                    yLabel: "Memory",
                    unit: "MB",
                }}
                caption="Numeric x positions preserve the uneven sampling intervals. The legend gives the last value."
            />
            <Area
                props={{
                    title: "Total memory and its parts",
                    x: [0, 1, 3, 4, 6],
                    series: workload,
                    mode: "stacked",
                    xLabel: "Elapsed time (s)",
                    yLabel: "Memory",
                    unit: "MB",
                }}
                caption="Stacked memory reaches 45 MB at 6 s: 20 + 15 + 10 MB."
            />
            <Area
                props={{
                    title: "Share of total memory",
                    x: [0, 1, 3, 4, 6],
                    series: workload,
                    mode: "percent",
                    xLabel: "Elapsed time (s)",
                    unit: "MB",
                }}
                caption="Each sampled time is normalized separately. Interpolation connects those shares."
            />
        </>
    );
}
