/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Gantt, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedJobs: FigureInputs["gantt"]["jobs"] = [
    {
        id: "P1",
        arrive: 0,
        burst: 8,
    },
    {
        id: "P2",
        arrive: 1,
        burst: 2,
    },
    {
        id: "P3",
        arrive: 2,
        burst: 3,
    },
    {
        id: "P4",
        arrive: 3,
        burst: 1,
    },
    {
        id: "P5",
        arrive: 4,
        burst: 2,
    },
];

const fcfsScheduleData = {
    policy: "fcfs",
    span: 16,
    jobs: sharedJobs,
} satisfies FigureInputs["gantt"];

const sjfScheduleData = {
    policy: "sjf",
    span: 16,
    jobs: sharedJobs,
} satisfies FigureInputs["gantt"];

const roundRobinScheduleData = {
    policy: "rr",
    quantum: 2,
    span: 16,
    jobs: sharedJobs,
} satisfies FigureInputs["gantt"];

export function FcfsSchedule(input: Partial<DiagramProps<"gantt">>) {
    return (
        <Gantt
            props={fcfsScheduleData}
            caption="A long first job makes all the shorter arrivals wait behind it."
            {...input}
        />
    );
}

export function SjfSchedule(input: Partial<DiagramProps<"gantt">>) {
    return (
        <Gantt
            props={sjfScheduleData}
            caption="After P1 finishes, shorter waiting jobs run first; P1 is not preempted."
            {...input}
        />
    );
}

export function RoundRobinSchedule(input: Partial<DiagramProps<"gantt">>) {
    return (
        <Gantt
            props={roundRobinScheduleData}
            caption="Two-unit time slices let short jobs finish before the long P1 completes."
            {...input}
        />
    );
}
