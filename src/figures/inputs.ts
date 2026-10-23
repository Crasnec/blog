/** Author inputs: closed, serializable shapes shared by the TSX components.
 * Decoders still enforce numeric ranges and relationships at build time.
 */
// Closed aliases retain JSON assignability without open index signatures.
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import type { Tone } from "#src/figures/kit.ts";
import type { QueueInput } from "#src/figures/kinds/queue.ts";
import type { SceneInput } from "#src/figures/scene/model.ts";

export type SampleGroup = { label: string; values: number[] };
export type ChartSeries = { label: string; values: number[]; tone?: Tone };
type ChartOptions = {
    title?: string;
    unit?: string;
    showLegend?: boolean;
    showValues?: boolean;
};
export type XY = { x: number; y: number };
export type Estimate = {
    label: string;
    estimate: number;
    low: number;
    high: number;
    weight?: number;
};
export type ScoredObservation = { score: number; label: 0 | 1 };
type Titled = { title?: string };
type Grouped = Titled & { groups: SampleGroup[]; unit?: string };
type Smoothed = Grouped & { bandwidth?: number };
type Paired = Titled & { points: XY[] };
type Quantiles = Titled & { samples: number[]; reference?: number[]; mean?: number; sd?: number };
type Intervals = Titled & { estimates: Estimate[]; reference?: number; xLabel?: string };
type Correlation = Titled & { values: number[]; lags?: number };
type Classification = Titled & { data: ScoredObservation[] };

export type FigureInputs = {
    scene: SceneInput;
    bar: ChartOptions & {
        categories: string[];
        series: ChartSeries[];
        orientation?: "vertical" | "horizontal";
        mode?: "grouped" | "stacked" | "percent";
        categoryLabel?: string;
        valueLabel?: string;
    };
    pie: ChartOptions & {
        slices: { label: string; value: number; tone?: Tone }[];
        variant?: "pie" | "donut";
        totalLabel?: string;
    };
    area: ChartOptions & {
        x: number[];
        series: ChartSeries[];
        mode?: "overlay" | "stacked" | "percent";
        xLabel?: string;
        yLabel?: string;
    };
    line: {
        series: { label?: string; values: number[]; tone?: Tone }[];
        unit?: string;
        xLabels?: string[];
        yMin?: number;
        yMax?: number;
        showValues?: boolean;
        notes?: { at: number; text: string }[];
    };
    distribution: {
        groups: { label: string; samples: number[] }[];
        min?: number;
        max?: number;
        bins?: number;
        unit?: string;
        markers?: (`p${number}` | number)[];
    };
    flow: {
        nodes: { id: string; label: string; x: number; y: number; sub?: string; tone?: Tone }[];
        edges?: {
            from: string;
            to: string;
            rate?: number;
            drop?: number;
            label?: string;
            tone?: Tone;
        }[];
    };
    sequence: {
        actors: { id: string; label: string; sub?: string }[];
        messages: {
            from: string;
            to: string;
            label: string;
            latency?: number;
            gap?: number;
            lost?: boolean;
            retransmits?: number;
            tone?: Tone;
        }[];
        notes?: { after: number; text: string }[];
        timeoutLabel?: string;
    };
    "state-machine": {
        states: { id: string; label: string; x: number; y: number }[];
        events: { id: string; label: string; tone?: "ok" | "fail" | "timer" }[];
        transitions: {
            from: string;
            to: string;
            on: string;
            count?: number;
            label?: string;
            bend?: number;
        }[];
        inputs: { at: number; event: string }[];
        start?: string;
    };
    sort: Titled & {
        algorithm: "bubble" | "insertion" | "quick" | "merge";
        values: number[];
        step?: number;
    };
    "grid-search": Titled & { algorithm: "bfs" | "dfs" | "greedy" | "astar"; maze: string[] };
    "hash-ring": {
        scheme: "ring" | "modulo";
        servers: string[];
        add: string;
        keys: string[];
        vnodes?: number;
    };
    tree: Titled & {
        operation: "bst-insert" | "bst-search" | "heap-insert";
        values: number[];
        target?: number;
        step?: number;
    };
    gantt: Titled & {
        policy: "fcfs" | "sjf" | "rr";
        jobs: { id: string; arrive: number; burst: number }[];
        quantum?: number;
        cores?: number;
        span?: number;
    };
    heatmap: Titled & {
        rows: string[];
        cols: string[];
        values: number[][];
        min?: number;
        max?: number;
        unit?: string;
        highlight?: number;
    };
    memory: Titled & {
        policy: "first-fit" | "best-fit" | "worst-fit" | "next-fit";
        heap?: number;
        requests: ({ op: "alloc"; id: string; size: number } | { op: "free"; id: string })[];
    };
    "hex-editor": Titled & {
        bytes: number[];
        baseOffset?: number;
        selected?: number;
        actions?: (
            | { op: "select"; index: number; label?: string }
            | { op: "write"; index: number; value: number; label?: string }
        )[];
    };
    queue: QueueInput;
    scatter: Paired & { fit?: boolean; xLabel?: string; yLabel?: string };
    boxplot: Grouped;
    violin: Smoothed;
    ecdf: Grouped;
    qq: Quantiles;
    interval: Intervals;
    kde: Smoothed;
    beeswarm: Grouped;
    raincloud: Smoothed;
    boxen: Grouped;
    ridgeline: Smoothed;
    pp: Quantiles;
    hexbin: Paired & { bins?: number };
    "density-contour": Paired & { bandwidthX?: number; bandwidthY?: number };
    pairplot: Titled & { columns: string[]; rows: number[][] };
    jointplot: Paired;
    forest: Intervals & { pooled?: { label: string; estimate: number; low: number; high: number } };
    funnel: Titled & { studies: { estimate: number; se: number }[]; center?: number };
    "bland-altman": Paired;
    mosaic: Titled & { rows: string[]; cols: string[]; counts: number[][] };
    residual: Paired;
    "scale-location": Paired;
    influence: Paired;
    acf: Correlation;
    pacf: Correlation;
    lag: Titled & { values: number[]; lag?: number };
    "kaplan-meier": Titled & {
        groups: { label: string; observations: { time: number; event: boolean }[] }[];
    };
    roc: Classification;
    "precision-recall": Classification;
    calibration: Classification & { bins?: number };
};

export type FigureKindName = keyof FigureInputs;
