/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Line, Distribution, Flow, Queue, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";
import { lognormalSamples } from "../../../../figures/generators";

const deploymentLatencyData = {
	unit: "p99 지연 (ms)",
	xLabels: ["14:00", "14:30", "15:00"],
	series: [
		{
			label: "p99", values: [180, 175, 190, 185, 182, 640, 720, 690, 300, 190, 185, 180, 178]
		},
		{
			label: "p50", values: [60, 58, 62, 61, 60, 95, 110, 104, 70, 62, 60, 59, 60], tone: "muted"
		},
	],
	notes: [
		{
			at: 5, text: "v2.3 배포"
		},
		{
			at: 8, text: "롤백"
		},
	]
} satisfies FigureInputs["line"];

const latencyDistributionData = {
	unit: "ms",
	max: 1000,
	groups: [
		{
			label: "서버 A", samples: [...lognormalSamples(70, 130, 0.25, 1)]
		},
		{
			label: "서버 B", samples: [...lognormalSamples(66, 95, 0.3, 2), ...[430, 470, 520, 610, 900]]
		}
	],
	markers: ["p50", "p99"]
} satisfies FigureInputs["distribution"];

const serviceFlowData = {
	nodes: [
		{
			id: "client", label: "Client", x: 0, y: 0.5
		},
		{
			id: "api", label: "API", sub: "pool 32", x: 0.42, y: 0.5
		},
		{
			id: "cache", label: "Redis", x: 1, y: 0.1
		},
		{
			id: "db", label: "Postgres", sub: "느림", x: 1, y: 0.9, tone: "warn"
		},
	],
	edges: [
		{
			from: "client", to: "api", rate: 3
		},
		{
			from: "api", to: "cache", rate: 1.8
		},
		{
			from: "api", to: "db", rate: 1.2, drop: 0.35, label: "timeout 2s"
		},
	]
} satisfies FigureInputs["flow"];

const workerQueuesData = {
	servers: 2,
	arrivals: [0, 0, 0, 1, 1, 2],
	services: [8, 1, 1, 1, 1, 1],
	policies: [
		{
			policy: "per-server", label: "작업자별 대기열"
		},
		{
			policy: "shared", label: "공유 작업 대기열"
		}
	],
	unit: "초",
	entryLabel: "작업 도착",
	doneLabel: "처리 완료",
	waitingLabel: "대기 작업",
	highlight: {
		index: 0, label: "긴 작업"
	}
} satisfies FigureInputs["queue"];

export function DeploymentLatency(input: Partial<DiagramProps<"line">>) {
	return <Line props={deploymentLatencyData} caption="배포 직후 p99 지연이 튀고, 롤백한 뒤에야 내려온다." {...input} />;
}

export function LatencyDistribution(input: Partial<DiagramProps<"distribution">>) {
	return <Distribution props={latencyDistributionData} caption="평균은 B가 더 빠르지만, B의 p99는 A의 네 배다." {...input} />;
}

export function ServiceFlow(input: Partial<DiagramProps<"flow">>) {
	return <Flow props={serviceFlowData} caption="DB가 느려지면 API에서 나간 요청의 3분의 1이 타임아웃으로 사라진다." {...input} />;
}

export function WorkerQueues(input: Partial<DiagramProps<"queue">>) {
	return <Queue props={workerQueuesData} caption="같은 작업을 두 정책으로 처리한다. 숫자는 원래 시간 단위의 실제 대기 시간이다." {...input} />;
}
