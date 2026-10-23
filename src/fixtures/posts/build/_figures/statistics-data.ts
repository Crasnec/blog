/** Reproducible example inputs, shared by the gallery and regression tests. */
import { mean, normal, random } from "#src/figures/kit.ts";
import { variance } from "#src/figures/statistics/math.ts";
import type {
    FigureInputs,
    FigureKindName,
    ScoredObservation,
} from "#src/figures/inputs.ts";

export type StatisticsCategory =
    "distribution" | "relationship" | "estimate" | "diagnostic" | "prediction";
type StatisticsKind = Exclude<
    FigureKindName,
    | "line"
    | "distribution"
    | "flow"
    | "sequence"
    | "state-machine"
    | "sort"
    | "grid-search"
    | "hash-ring"
    | "tree"
    | "gantt"
    | "heatmap"
    | "memory"
    | "queue"
>;
export type StatisticsExample = {
    [K in StatisticsKind]: {
        kind: K;
        title: string;
        caption: string;
        category: StatisticsCategory;
        props: FigureInputs[K];
    };
}[StatisticsKind];

const rand = random(729);
const round = (value: number) => Math.round(value * 1000) / 1000;
const groups = [
    { label: "A", values: Array.from({ length: 40 }, () => round(normal(rand))) },
    { label: "B", values: Array.from({ length: 40 }, () => round(1.2 + normal(rand) * 1.3)) },
    {
        label: "C",
        values: Array.from({ length: 40 }, (_, i) =>
            round((i % 2 === 0 ? -1.4 : 2.5) + normal(rand) * 0.45),
        ),
    },
];
const xy = Array.from({ length: 60 }, (_, i) => ({
    x: round(i / 8),
    y: round((0.7 * i) / 8 + normal(rand) * 0.9),
}));
const clouds = Array.from({ length: 160 }, (_, i) => ({
    x: round((i % 2 ? 1.8 : -1.4) + normal(rand) * 0.65),
    y: round((i % 2 ? 1 : -1) + normal(rand) * 0.75),
}));
const diagnosticPoints = [...xy, { x: 10, y: 14 }];
const estimates = groups.map((g) => {
    const estimate = mean(g.values);
    const margin = 1.95996398454 * Math.sqrt(variance(g.values) / g.values.length);
    return { label: g.label, estimate, low: estimate - margin, high: estimate + margin };
});
const studies = [0.35, 0.7, 0.2, 0.5, 0.45].map((estimate, i) => {
    const se = 0.1 + i * 0.025;
    return {
        label: `Study ${String(i + 1)}`,
        estimate,
        low: estimate - 1.96 * se,
        high: estimate + 1.96 * se,
        weight: 1 / (se * se),
    };
});
const totalWeight = studies.reduce((a, s) => a + s.weight, 0);
const pooled = studies.reduce((a, s) => a + s.estimate * s.weight, 0) / totalWeight;
const series: number[] = [];
for (let i = 0; i < 96; i++) {
    series.push(round(0.72 * (series.at(-1) ?? 0) + normal(rand) * 0.7));
}
const scored: ScoredObservation[] = Array.from({ length: 140 }, () => {
    const score = round(0.01 + rand() * 0.98);
    return { score, label: rand() < score ? 1 : 0 };
});
scored.push({ score: 0, label: 0 }, { score: 1, label: 1 });
const survival = [8, 13].map((scale, i) => ({
    label: i === 0 ? "A" : "B",
    observations: Array.from({ length: 30 }, () => {
        const eventTime = -Math.log(Math.max(1e-9, rand())) * scale;
        const censorTime = 8 + rand() * 12;
        return { time: round(Math.min(eventTime, censorTime)), event: eventTime <= censorTime };
    }),
}));

export const statisticsExamples: StatisticsExample[] = [
    {
        kind: "scatter",
        title: "Scatter plot",
        category: "relationship",
        caption: "Dots are observations; the line is their fitted least-squares regression.",
        props: { points: xy, fit: true },
    },
    {
        kind: "boxplot",
        title: "Boxplot",
        category: "distribution",
        caption:
            "Boxes cover the central 50%; whiskers reach observations within 1.5 IQR, with outlying values retained as dots.",
        props: { groups },
    },
    {
        kind: "violin",
        title: "Violin plot",
        category: "distribution",
        caption:
            "C has two peaks. Equal maximum widths make contours comparable without encoding sample size.",
        props: { groups },
    },
    {
        kind: "ecdf",
        title: "Empirical cumulative distribution",
        category: "distribution",
        caption:
            "Read the fraction at or below each value. Tied observations accumulate in one step.",
        props: { groups },
    },
    {
        kind: "qq",
        title: "Q–Q plot",
        category: "distribution",
        caption:
            "Compare sample A with normal quantiles fitted using its sample mean and standard deviation.",
        props: { samples: groups[0]?.values ?? [] },
    },
    {
        kind: "interval",
        title: "Point estimates and intervals",
        category: "estimate",
        caption:
            "Sample means and supplied normal-approximation 95% confidence intervals for three groups.",
        props: { estimates, xLabel: "mean · normal-approx. 95% CI" },
    },
    {
        kind: "kde",
        title: "Kernel density estimate",
        category: "distribution",
        caption: "Gaussian kernels are added across observations; bandwidth controls smoothing.",
        props: { groups },
    },
    {
        kind: "beeswarm",
        title: "Beeswarm plot",
        category: "distribution",
        caption:
            "Vertical position preserves the observed value; horizontal packing reduces overlap.",
        props: { groups },
    },
    {
        kind: "raincloud",
        title: "Raincloud plot",
        category: "distribution",
        caption: "Read the half density, box and individual observations together.",
        props: { groups },
    },
    {
        kind: "boxen",
        title: "Boxen plot",
        category: "distribution",
        caption:
            "Nested boxes expose progressively wider central quantile intervals with decreasing widths.",
        props: { groups },
    },
    {
        kind: "ridgeline",
        title: "Ridgeline plot",
        category: "distribution",
        caption:
            "Compare shapes on one value axis. Every density peak is normalised to the same height.",
        props: { groups },
    },
    {
        kind: "pp",
        title: "P–P plot",
        category: "distribution",
        caption: "Compare the cumulative probabilities of A and B at the same observed values.",
        props: { samples: groups[0]?.values ?? [], reference: groups[1]?.values ?? [] },
    },
    {
        kind: "hexbin",
        title: "Hexbin plot",
        category: "relationship",
        caption: "A fixed hexagonal grid counts observations; darker cells contain more points.",
        props: { points: clouds, bins: 12 },
    },
    {
        kind: "density-contour",
        title: "Density contours",
        category: "relationship",
        caption:
            "Contours mark 15%, 35%, 60% and 85% of peak density, not enclosed probability or confidence.",
        props: { points: clouds },
    },
    {
        kind: "pairplot",
        title: "Scatterplot matrix",
        category: "relationship",
        caption: "Each panel compares a pair of variables; diagonal panels show histograms.",
        props: {
            columns: ["x", "y", "z"],
            rows: xy.map((p) => [p.x, p.y, round(normal(rand) * 2)]),
        },
    },
    {
        kind: "jointplot",
        title: "Joint and marginal distributions",
        category: "relationship",
        caption:
            "The top histogram counts x and the right histogram counts y on their corresponding scatter axes.",
        props: { points: clouds },
    },
    {
        kind: "forest",
        title: "Forest plot",
        category: "estimate",
        caption:
            "Square areas encode inverse-variance weights; the diamond is a supplied common-effect pooled interval.",
        props: {
            estimates: studies,
            pooled: {
                label: "Pooled",
                estimate: pooled,
                low: pooled - 1.96 / Math.sqrt(totalWeight),
                high: pooled + 1.96 / Math.sqrt(totalWeight),
            },
        },
    },
    {
        kind: "funnel",
        title: "Funnel plot",
        category: "estimate",
        caption:
            "Smaller standard errors appear higher. Guides show centre ± 1.96 SE; asymmetry alone does not establish bias.",
        props: {
            studies: Array.from({ length: 35 }, () => {
                const se = 0.08 + rand() * 0.55;
                return { estimate: 0.4 + normal(rand) * se, se };
            }),
        },
    },
    {
        kind: "bland-altman",
        title: "Bland–Altman plot",
        category: "relationship",
        caption:
            "Paired differences versus means, with normal-approximation limits of agreement rather than mean confidence intervals.",
        props: {
            points: xy.map((p) => ({ x: 10 + p.x, y: 11.5 + 1.05 * p.x + normal(rand) * 0.7 })),
        },
    },
    {
        kind: "mosaic",
        title: "Mosaic plot",
        category: "estimate",
        caption:
            "Cell area encodes count; colour shows the sign and magnitude of the Pearson residual under independence.",
        props: {
            rows: ["A", "B", "C"],
            cols: ["X", "Y", "Z"],
            counts: [
                [35, 12, 8],
                [14, 30, 16],
                [6, 18, 31],
            ],
        },
    },
    {
        kind: "residual",
        title: "Residual plot",
        category: "diagnostic",
        caption:
            "Fitted values and residuals come from a simple linear regression on these observations.",
        props: { points: diagnosticPoints },
    },
    {
        kind: "scale-location",
        title: "Scale–location plot",
        category: "diagnostic",
        caption:
            "The square root of absolute internally standardised residuals reveals changes in spread.",
        props: { points: diagnosticPoints },
    },
    {
        kind: "influence",
        title: "Influence plot",
        category: "diagnostic",
        caption:
            "Leverage versus standardised residual, with point area reflecting Cook's distance. Red marks exceed the 4/n heuristic.",
        props: { points: diagnosticPoints },
    },
    {
        kind: "acf",
        title: "Autocorrelation",
        category: "diagnostic",
        caption:
            "Lags start at one. Dashed guides are approximate pointwise white-noise references.",
        props: { values: series, lags: 12 },
    },
    {
        kind: "pacf",
        title: "Partial autocorrelation",
        category: "diagnostic",
        caption:
            "Yule–Walker partial autocorrelations separate short-lag direct relationships in the same series.",
        props: { values: series, lags: 12 },
    },
    {
        kind: "lag",
        title: "Lag plot",
        category: "diagnostic",
        caption:
            "Each dot pairs consecutive observations, with identical value ranges on both axes.",
        props: { values: series, lag: 1 },
    },
    {
        kind: "kaplan-meier",
        title: "Kaplan–Meier survival curve",
        category: "prediction",
        caption:
            "Events cause drops; censoring leaves marks. Bands are log-log Greenwood 95% intervals.",
        props: { groups: survival },
    },
    {
        kind: "roc",
        title: "ROC curve",
        category: "prediction",
        caption:
            "Tied scores advance together as false positive and true positive rates change with the threshold.",
        props: { data: scored },
    },
    {
        kind: "precision-recall",
        title: "Precision–recall curve",
        category: "prediction",
        caption:
            "Step-weighted area gives average precision; the horizontal reference is positive prevalence.",
        props: { data: scored },
    },
    {
        kind: "calibration",
        title: "Calibration curve",
        category: "prediction",
        caption:
            "Nonempty bins compare mean predicted probability with observed positive fraction; sizes reflect counts.",
        props: { data: scored, bins: 8 },
    },
];
