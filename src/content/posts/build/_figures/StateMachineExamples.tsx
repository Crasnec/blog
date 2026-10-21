/** Post-specific data and captions; all drawing uses reusable typed components. */
import { StateMachine, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const circuitBreakerData = {
	states: [
		{
			id: "closed", label: "CLOSED", x: 0, y: 0.82
		},
		{
			id: "half", label: "HALF-OPEN", x: 0.5, y: 0
		},
		{
			id: "open", label: "OPEN", x: 1, y: 0.82
		},
	],
	start: "closed",
	events: [
		{
			id: "ok", label: "성공", tone: "ok"
		},
		{
			id: "fail", label: "실패", tone: "fail"
		},
		{
			id: "timer", label: "대기 끝", tone: "timer"
		},
	],
	transitions: [
		{
			from: "closed", to: "closed", on: "ok", label: "성공"
		},
		{
			from: "closed", to: "open", on: "fail", count: 3, label: "연속 실패"
		},
		{
			from: "open", to: "half", on: "timer", label: "대기 끝"
		},
		{
			from: "half", to: "open", on: "fail", label: "시험 실패"
		},
		{
			from: "half", to: "closed", on: "ok", label: "시험 성공"
		},
	],
	inputs: [
		{
			at: 0.8, event: "ok"
		},
		{
			at: 1.4, event: "fail"
		},
		{
			at: 2.0, event: "fail"
		},
		{
			at: 2.6, event: "ok"
		},
		{
			at: 3.2, event: "fail"
		},
		{
			at: 3.8, event: "fail"
		},
		{
			at: 4.4, event: "fail"
		},
		{
			at: 6.2, event: "timer"
		},
		{
			at: 7.2, event: "fail"
		},
		{
			at: 8.8, event: "timer"
		},
		{
			at: 9.8, event: "ok"
		},
		{
			at: 10.6, event: "ok"
		},
	]
} satisfies FigureInputs["state-machine"];

export function CircuitBreaker(input: Partial<DiagramProps<"state-machine">>) {
	return <StateMachine props={circuitBreakerData} caption="실패가 세 번 연달아 나야 열린다. 중간에 성공이 한 번 끼면 셈이 처음부터 다시 시작된다." {...input} />;
}
