/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Heatmap, type DiagramProps } from "#src/components/figures/index.tsx";
import type { FigureInputs } from "#src/figures/inputs.ts";
import { dailyPeak } from "#src/figures/presets/daily-peak.ts";

const rowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const columnLabels = [
    "00:00",
    "01:00",
    "02:00",
    "03:00",
    "04:00",
    "05:00",
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
    "23:00",
];

const weeklyLatencyData = {
    rows: rowLabels,
    cols: columnLabels,
    values: dailyPeak(
        {
            model: "daily-peak",
            base: 110,
            peak: 480,
            peakHour: 20,
            spread: 2.2,
            daytime: 0.3,
            weekend: ["Sat", "Sun"],
            spikes: [
                {
                    row: "Mon",
                    col: "09:00",
                    add: 650,
                },
            ],
            noise: 0.1,
            seed: 4,
        },
        rowLabels,
        columnLabels,
        "example.values",
    ),
    unit: "ms",
    highlight: 3,
} satisfies FigureInputs["heatmap"];

export function WeeklyLatency(input: Partial<DiagramProps<"heatmap">>) {
    return (
        <Heatmap
            props={weeklyLatencyData}
            caption="Weekday evenings form a dark band around 20:00; Monday at 09:00 is darker still."
            label="API p95 latency by weekday and hour: high on weekday evenings, lower on weekends, highest on Monday at 09:00."
            {...input}
        />
    );
}
