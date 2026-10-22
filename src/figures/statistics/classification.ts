/** Threshold curves use whole tied-score groups; calibration uses probabilities. */
import { arr, defineFigure, dot, mean, obj, progress, withAlpha, type Point } from "../kit.ts";
import { binaryCurves, calibrationBins } from "./math.ts";
import { axes, bounded, clipped, common, curve, fmt, header, reference, TIMES } from "./shared.ts";

function classification(style: "roc" | "precision-recall" | "calibration") {
    return defineFigure({
        duration: TIMES.duration,
        height: 320,
        decode(raw) {
            const p = obj(raw, "props");
            const data = arr(p.data, "props.data").map((v, i) => {
                const path = `props.data[${String(i)}]`;
                const d = obj(v, path);
                return {
                    score: bounded(
                        d.score,
                        `${path}.score`,
                        style === "calibration" ? 0 : -1e12,
                        style === "calibration" ? 1 : 1e12,
                    ),
                    positive: bounded(d.label, `${path}.label`, 0, 1, true) === 1,
                };
            });
            if (data.length < 2 || data.length > 4000)
            {
                throw new Error("props.data needs 2–4000 scored observations");
            }
            const bins = p.bins === undefined ? 10 : bounded(p.bins, "props.bins", 2, 20, true);
            const calibrated = style === "calibration" ? calibrationBins(data, bins) : [];
            const curves = style === "calibration" ? undefined : binaryCurves(data);
            let plotted: Point[];
            if (style === "calibration") {
                plotted = calibrated;
            }
            else if (style === "roc") {
                plotted = curves?.roc ?? [];
            }
            else {
                const pr = curves?.pr ?? [];
                plotted = pr.flatMap((p, i) =>
                    i === 0 ? [p] : [{ x: pr[i - 1]?.x ?? 0, y: p.y }, p],
                );
            }
            const brier = mean(data.map((d) => (d.score - Number(d.positive)) ** 2));
            return {
                ...common(
                    p,
                    style === "roc"
                        ? "ROC curve"
                        : style === "precision-recall"
                            ? "Precision–recall curve"
                            : "Probability calibration",
                ),
                plotted,
                calibrated,
                prevalence: curves?.prevalence ?? 0,
                summary:
                    style === "roc"
                        ? `AUC=${fmt(curves?.auc ?? 0)}`
                        : style === "precision-recall"
                            ? `average precision=${fmt(curves?.ap ?? 0)}`
                            : `Brier=${fmt(brier)} · ${String(calibrated.length)}/${String(bins)} occupied bins`,
            };
        },
        draw(frame, p) {
            header(frame, p.title, p.summary);
            const plot = axes(frame, [0, 1], [0, 1], {
                xLabel:
                    style === "roc"
                        ? "false positive rate"
                        : style === "precision-recall"
                            ? "recall"
                            : "mean predicted probability",
                yLabel:
                    style === "roc"
                        ? "true positive rate"
                        : style === "precision-recall"
                            ? "precision"
                            : "observed positive fraction",
            });
            reference(
                frame,
                plot,
                { x: 0, y: style === "precision-recall" ? p.prevalence : 0 },
                { x: 1, y: style === "precision-recall" ? p.prevalence : 1 },
            );
            curve(frame, plot, p.plotted);
            if (style === "calibration") {
                const max = Math.max(...p.calibrated.map((b) => b.count));
                clipped(frame, plot.rect, () => {
                    p.calibrated.forEach((b, i) => {
                        withAlpha(
                            frame.ctx,
                            progress(
                                frame.time,
                                TIMES.start + (i / p.calibrated.length) * TIMES.reveal,
                                0.3,
                            ),
                            () => {
                                dot(
                                    frame.ctx,
                                    plot.x(b.x),
                                    plot.y(b.y),
                                    2 + 4 * Math.sqrt(b.count / max),
                                    frame.palette.marker,
                                );
                            },
                        );
                    });
                });
            }
        },
    });
}

export const roc = classification("roc");
export const precisionRecall = classification("precision-recall");
export const calibration = classification("calibration");
