import type { Tone } from "../kit.ts";

export interface Series {
    label: string;
    values: number[];
    tone: Tone;
}

export interface Options {
    title: string;
    unit: string;
    showLegend: boolean;
    showValues: boolean;
}

export interface Segment {
    from: number;
    to: number;
    value: number;
}

export interface Domain {
    min: number;
    max: number;
    ticks: number[];
}

export interface BarModel extends Options {
    categories: string[];
    series: Series[];
    segments: Segment[][];
    domain: Domain;
    orientation: "vertical" | "horizontal";
    mode: "grouped" | "stacked" | "percent";
    categoryLabel: string;
    valueLabel: string;
}

export interface AreaModel extends Options {
    x: number[];
    series: Series[];
    segments: Segment[][];
    domain: Domain;
    mode: "overlay" | "stacked" | "percent";
    xLabel: string;
    yLabel: string;
}

export interface Slice {
    label: string;
    value: number;
    tone: Tone;
    from: number;
    to: number;
    percent: number;
}

export interface PieModel extends Options {
    slices: Slice[];
    total: number;
    totalLabel: string;
    variant: "pie" | "donut";
}
