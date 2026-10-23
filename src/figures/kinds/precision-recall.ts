/**
 * precision-recall — data:{score:number,label:0|1}[]; title?. Step area is average precision, not
 * trapezoidal PR AUC.
 * Full contract and numerical conventions: ../statistics/README.md.
 */
export { precisionRecall as default } from "#src/figures/statistics/classification.ts";
