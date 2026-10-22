/** Diagnostics for an intercept + one-predictor OLS model fitted to the points. */
import { defineFigure, dot, obj, progress, withAlpha } from "../kit.ts";
import { linearFit } from "./math.ts";
import {
    axes,
    clipped,
    common,
    extent,
    fmt,
    header,
    points,
    readPoints,
    reference,
    TIMES,
} from "./shared.ts";

function diagnostic(style: "residual" | "scale-location" | "influence", title: string) {
    return defineFigure({
        duration: TIMES.duration,
        height: 320,
        decode(raw) {
            const p = obj(raw, "props");
            const fit = linearFit(readPoints(p, 4));
            if (style !== "residual" && fit.diagnostics.some((d) => d.leverage >= 1 - 1e-12))
                throw new Error(
                    "props.points has unit leverage; standardized residuals are undefined",
                );
            const data = fit.diagnostics.map((d) => ({
                x: style === "influence" ? d.leverage : d.fitted,
                y:
                    style === "residual"
                        ? d.residual
                        : style === "influence"
                            ? d.standardized
                            : Math.sqrt(Math.abs(d.standardized)),
                cook: d.cook,
            }));
            return {
                ...common(p, title),
                data,
                fit,
                xd: extent(data.map((d) => d.x)),
                yd: extent([...data.map((d) => d.y), 0]),
            };
        },
        draw(frame, p) {
            header(
                frame,
                p.title,
                `OLS · n=${String(p.data.length)} · R²=${fmt(p.fit.r2)}${style === "influence" ? " · point area ∝ Cook's D" : ""}`,
            );
            const plot = axes(frame, p.xd, p.yd, {
                xLabel: style === "influence" ? "leverage" : "fitted value",
                yLabel:
                    style === "residual"
                        ? "residual"
                        : style === "influence"
                            ? "standardized residual"
                            : "√|standardized residual|",
            });
            reference(frame, plot, { x: p.xd[0], y: 0 }, { x: p.xd[1], y: 0 });
            if (style !== "influence") points(frame, plot, p.data);
            else {
                const maxCook = Math.max(...p.data.map((d) => d.cook));
                clipped(frame, plot.rect, () => {
                    p.data.forEach((d, i) => {
                        withAlpha(
                            frame.ctx,
                            progress(
                                frame.time,
                                TIMES.start + (i / p.data.length) * TIMES.reveal,
                                0.3,
                            ) * 0.65,
                            () => {
                                dot(
                                    frame.ctx,
                                    plot.x(d.x),
                                    plot.y(d.y),
                                    maxCook === 0
                                        ? 3
                                        : Math.max(2, 13 * Math.sqrt(d.cook / maxCook)),
                                    d.cook > 4 / p.data.length
                                        ? frame.palette.danger
                                        : frame.palette.marker,
                                );
                            },
                        );
                    });
                });
            }
        },
    });
}

export const residual = diagnostic("residual", "Residuals vs fitted");
export const scaleLocation = diagnostic("scale-location", "Scale–location plot");
export const influence = diagnostic("influence", "OLS influence plot");
