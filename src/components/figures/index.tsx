/** Typed, data-only TSX components for every reusable kind. */
import Figure, { type FigureProps } from "../Figure";
import type { FigureInputs, FigureKindName } from "../../figures/inputs";

export type DiagramProps<K extends FigureKindName> = Omit<FigureProps, "kind" | "props"> & {
    props: FigureInputs[K];
};

function component<K extends FigureKindName>(kind: K) {
    return function Diagram(input: DiagramProps<K>) {
        return <Figure {...input} kind={kind} />;
    };
}

export const Line = component("line");
export const Distribution = component("distribution");
export const Flow = component("flow");
export const Sequence = component("sequence");
export const StateMachine = component("state-machine");
export const Sort = component("sort");
export const GridSearch = component("grid-search");
export const HashRing = component("hash-ring");
export const Tree = component("tree");
export const Gantt = component("gantt");
export const Heatmap = component("heatmap");
export const Memory = component("memory");
export const HexEditor = component("hex-editor");
export const Queue = component("queue");
export const Scatter = component("scatter");
export const Boxplot = component("boxplot");
export const Violin = component("violin");
export const ECDF = component("ecdf");
export const QQ = component("qq");
export const Interval = component("interval");
export const KDE = component("kde");
export const Beeswarm = component("beeswarm");
export const Raincloud = component("raincloud");
export const Boxen = component("boxen");
export const Ridgeline = component("ridgeline");
export const PP = component("pp");
export const Hexbin = component("hexbin");
export const DensityContour = component("density-contour");
export const Pairplot = component("pairplot");
export const Jointplot = component("jointplot");
export const Forest = component("forest");
export const Funnel = component("funnel");
export const BlandAltman = component("bland-altman");
export const Mosaic = component("mosaic");
export const Residual = component("residual");
export const ScaleLocation = component("scale-location");
export const Influence = component("influence");
export const ACF = component("acf");
export const PACF = component("pacf");
export const Lag = component("lag");
export const KaplanMeier = component("kaplan-meier");
export const ROC = component("roc");
export const PrecisionRecall = component("precision-recall");
export const Calibration = component("calibration");
