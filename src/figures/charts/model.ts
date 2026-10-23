/** Validated chart inputs and numeric geometry; no DOM or canvas dependency. */
export {
    type Series,
    type Options,
    type Segment,
    type Domain,
    type BarModel,
    type AreaModel,
    type Slice,
    type PieModel,
} from "#src/figures/charts/types.ts";
export { segments, numericDomain } from "#src/figures/charts/geometry.ts";
export { decodeBar, decodeArea, decodePie } from "#src/figures/charts/decode.ts";
