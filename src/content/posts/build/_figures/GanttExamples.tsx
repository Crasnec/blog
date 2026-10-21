/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Gantt, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedJobs: FigureInputs["gantt"]["jobs"] = [
	{
		id: "P1", arrive: 0, burst: 8
	},
	{
		id: "P2", arrive: 1, burst: 2
	},
	{
		id: "P3", arrive: 2, burst: 3
	},
	{
		id: "P4", arrive: 3, burst: 1
	},
	{
		id: "P5", arrive: 4, burst: 2
	},
];

const fcfsScheduleData = {
	policy: "fcfs",
	span: 16,
	jobs: sharedJobs
} satisfies FigureInputs["gantt"];

const sjfScheduleData = {
	policy: "sjf",
	span: 16,
	jobs: sharedJobs
} satisfies FigureInputs["gantt"];

const roundRobinScheduleData = {
	policy: "rr",
	quantum: 2,
	span: 16,
	jobs: sharedJobs
} satisfies FigureInputs["gantt"];

export function FcfsSchedule(input: Partial<DiagramProps<"gantt">>) {
	return <Gantt props={fcfsScheduleData} caption="긴 작업이 먼저 잡으면 뒤의 짧은 작업들이 모두 그 뒤에 줄을 선다." {...input} />;
}

export function SjfSchedule(input: Partial<DiagramProps<"gantt">>) {
	return <Gantt props={sjfScheduleData} caption="P1이 끝난 뒤에는 짧은 것부터 고르지만, 이미 시작한 P1을 멈추지는 않는다." {...input} />;
}

export function RoundRobinSchedule(input: Partial<DiagramProps<"gantt">>) {
	return <Gantt props={roundRobinScheduleData} caption="2씩 돌아가며 나눠 쓰니 짧은 작업은 금방 끝나고, 긴 P1은 맨 마지막에 끝난다." {...input} />;
}
