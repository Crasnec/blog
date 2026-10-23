/**
 * Stable author API for animated figures. Implementations live in core/.
 * Draw the full frame from time and explicit props; use seeded randomness.
 * See README.md for authoring and docs/architecture.md for module boundaries.
 */
export {
    type Palette,
    type Frame,
    type FigureKind,
    type FigureTable,
    type BoundFigure,
    type DefinedFigure,
    defineFigure,
} from "./core/definition.ts";
export {
    clamp,
    lerp,
    progress,
    ease,
    between,
    flash,
    pulse,
    stagger,
    phases,
    countUp,
} from "./core/time.ts";
export {
    random,
    normal,
    lognormal,
    arrivals,
    pick,
    sum,
    mean,
    percentile,
    hash32,
    trimNumber,
    tickStep,
    scale,
    niceMax,
    compact,
    formatNumber,
} from "./core/data.ts";
export {
    type Rect,
    canvasRect,
    inset,
    rows,
    cols,
    center,
    gridCell,
    fitAspect,
    polar,
    type Point,
    along,
    alongPath,
    bendPoint,
    alongCurve,
    edgePoint,
    distanceToSegment,
    type LabelSpot,
    labelSpot,
} from "./core/geometry.ts";
export { type TextStyle, text, fittedText, label, chip, slantedLabel, badge } from "./core/text.ts";
export {
    line,
    dot,
    box,
    partialPath,
    ring,
    burst,
    arrow,
    curvedArrow,
    arc,
    arrowHead,
    hatch,
    rampFill,
    bar,
    cells,
    withAlpha,
} from "./core/paint.ts";
export { heat, type Tone, TONES, toneColor } from "./core/palette.ts";
export { PropError, obj, arr, num, str, nums, tone, maybe } from "./core/decode.ts";
