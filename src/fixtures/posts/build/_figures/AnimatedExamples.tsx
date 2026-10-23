/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Line, Distribution, Flow, Queue, type DiagramProps } from "#src/components/figures/index.tsx";
import type { FigureInputs } from "#src/figures/inputs.ts";
import { lognormalSamples } from "#src/figures/generators.ts";

const deploymentLatencyData = {
    unit: "p99 latency (ms)",
    xLabels: ["14:00", "14:30", "15:00"],
    series: [
        {
            label: "p99",
            values: [180, 175, 190, 185, 182, 640, 720, 690, 300, 190, 185, 180, 178],
        },
        {
            label: "p50",
            values: [60, 58, 62, 61, 60, 95, 110, 104, 70, 62, 60, 59, 60],
            tone: "muted",
        },
    ],
    notes: [
        {
            at: 5,
            text: "Deploy v2.3",
        },
        {
            at: 8,
            text: "Rollback",
        },
    ],
} satisfies FigureInputs["line"];

const latencyDistributionData = {
    unit: "ms",
    max: 1000,
    groups: [
        {
            label: "Server A",
            samples: [...lognormalSamples(70, 130, 0.25, 1)],
        },
        {
            label: "Server B",
            samples: [...lognormalSamples(66, 95, 0.3, 2), ...[430, 470, 520, 610, 900]],
        },
    ],
    markers: ["p50", "p99"],
} satisfies FigureInputs["distribution"];

const serviceFlowData = {
    nodes: [
        {
            id: "client",
            label: "Client",
            x: 0,
            y: 0.5,
        },
        {
            id: "api",
            label: "API",
            sub: "pool 32",
            x: 0.42,
            y: 0.5,
        },
        {
            id: "cache",
            label: "Redis",
            x: 1,
            y: 0.1,
        },
        {
            id: "db",
            label: "Postgres",
            sub: "slow",
            x: 1,
            y: 0.9,
            tone: "warn",
        },
    ],
    edges: [
        {
            from: "client",
            to: "api",
            rate: 3,
        },
        {
            from: "api",
            to: "cache",
            rate: 1.8,
        },
        {
            from: "api",
            to: "db",
            rate: 1.2,
            drop: 0.35,
            label: "timeout 2s",
        },
    ],
} satisfies FigureInputs["flow"];

const workerQueuesData = {
    servers: 2,
    arrivals: [0, 0, 0, 1, 1, 2],
    services: [8, 1, 1, 1, 1, 1],
    policies: [
        {
            policy: "per-server",
            label: "Dedicated queues",
        },
        {
            policy: "shared",
            label: "Shared queue",
        },
    ],
    unit: "s",
    entryLabel: "Arrivals",
    doneLabel: "Done",
    waitingLabel: "Waiting",
    highlight: {
        index: 0,
        label: "Long job",
    },
} satisfies FigureInputs["queue"];

export function DeploymentLatency(input: Partial<DiagramProps<"line">>) {
    return (
        <Line
            props={deploymentLatencyData}
            caption="p99 latency spikes after deployment and falls after rollback."
            {...input}
        />
    );
}

export function LatencyDistribution(input: Partial<DiagramProps<"distribution">>) {
    return (
        <Distribution
            props={latencyDistributionData}
            caption="Compare the central response times with the much longer upper tail of server B."
            {...input}
        />
    );
}

export function ServiceFlow(input: Partial<DiagramProps<"flow">>) {
    return (
        <Flow
            props={serviceFlowData}
            caption="The slow database causes one third of outgoing API requests to time out in this model."
            {...input}
        />
    );
}

export function WorkerQueues(input: Partial<DiagramProps<"queue">>) {
    return (
        <Queue
            props={workerQueuesData}
            caption="Both policies process the same jobs; summaries report waits in the original time unit."
            {...input}
        />
    );
}
