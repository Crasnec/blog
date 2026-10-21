/** acf — values:number[] (at least 4); lags?:integer; title?. Biased ACF, excludes lag zero.
 * Full contract and numerical conventions: ../statistics/README.md.
 */
export { acf as default } from "../statistics/series.ts";
