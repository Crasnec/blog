/**
 * kaplan-meier — groups:{label,observations:{time,event:boolean}[]}[]; title?. event=false means
 * right-censored.
 * Full contract and numerical conventions: ../statistics/README.md.
 */
export { kaplanMeierFigure as default } from "../statistics/survival.ts";
