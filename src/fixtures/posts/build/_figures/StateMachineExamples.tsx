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
			id: "ok", label: "Success", tone: "ok"
		},
		{
			id: "fail", label: "Failure", tone: "fail"
		},
		{
			id: "timer", label: "Timer expired", tone: "timer"
		},
	],
	transitions: [
		{
			from: "closed", to: "closed", on: "ok", label: "Success"
		},
		{
			from: "closed", to: "open", on: "fail", count: 3, label: "Consecutive failures"
		},
		{
			from: "open", to: "half", on: "timer", label: "Timer expired"
		},
		{
			from: "half", to: "open", on: "fail", label: "Probe failed"
		},
		{
			from: "half", to: "closed", on: "ok", label: "Probe succeeded"
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
	return <StateMachine props={circuitBreakerData} caption="Three consecutive failures open the breaker. A success resets the failure count." {...input} />;
}
