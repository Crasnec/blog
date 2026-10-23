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
} from "./types.ts";
export { segments, numericDomain } from "./geometry.ts";
export { decodeBar, decodeArea, decodePie } from "./decode.ts";
