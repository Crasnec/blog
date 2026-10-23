/** Models reusable from TSX, tests, or another renderer; none requires a DOM. */
export { traceSort } from "#src/figures/models/sort.ts";
export { searchGrid } from "#src/figures/models/grid-search.ts";
export { traceTree } from "#src/figures/models/tree.ts";
export { planHashing } from "#src/figures/models/hash-ring.ts";
export { schedule } from "#src/figures/models/gantt.ts";
export { simulate as simulateAllocation, holesOf } from "#src/figures/models/memory.ts";
export { runMachine } from "#src/figures/models/state-machine.ts";
export { simulateQueue } from "#src/figures/models/queue.ts";
export { traceHexEditor } from "#src/figures/models/hex-editor.ts";
