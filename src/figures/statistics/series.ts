import { defineFigure, dot, line, obj, progress, withAlpha } from "../kit.ts";
import { autocorrelation, partialAutocorrelation } from "./math.ts";
import {
    axes,
    bounded,
    clipped,
    common,
    extent,
    fmt,
    header,
    points,
    reference,
    sample,
    TIMES,
} from "./shared.ts";

function correlogram(partial: boolean) {
    return defineFigure({
        duration: TIMES.duration,
        height: 300,
        decode(raw) {
            const p = obj(raw, "props");
            const values = sample(p.values, "props.values", 4);
            const max = Math.min(40, Math.floor(values.length / 2) - 1);
            const lags =
                p.lags === undefined
                    ? Math.min(16, max)
                    : bounded(p.lags, "props.lags", 1, max, true);
            const acf = autocorrelation(values, lags);
            return {
                ...common(p, partial ? "Partial autocorrelation" : "Autocorrelation"),
                correlations: (partial ? partialAutocorrelation(acf) : acf).slice(1),
                n: values.length,
                band: 1.95996398454 / Math.sqrt(values.length),
            };
        },
        draw(frame, p) {
            header(
                frame,
                p.title,
                `n=${String(p.n)} · white-noise reference: ±${fmt(p.band)} (approx. 95%)`,
            );
            const plot = axes(frame, [0.5, p.correlations.length + 0.5], [-1, 1], {
                xLabel: "lag (starts at 1)",
                yLabel: partial ? "partial autocorrelation" : "autocorrelation",
            });
            for (const value of [-p.band, 0, p.band])
            {
                reference(
                    frame,
                    plot,
                    { x: 0.5, y: value },
                    { x: p.correlations.length + 0.5, y: value },
                );
            }
            clipped(frame, plot.rect, () => {
                p.correlations.forEach((value, i) => {
                    withAlpha(
                        frame.ctx,
                        progress(
                            frame.time,
                            TIMES.start + (i / p.correlations.length) * TIMES.reveal,
                            0.4,
                        ),
                        () => {
                            line(
                                frame.ctx,
                                plot.x(i + 1),
                                plot.y(0),
                                plot.x(i + 1),
                                plot.y(value),
                                frame.palette.marker,
                                Math.min(5, (plot.rect.w / p.correlations.length) * 0.35),
                            );
                            dot(frame.ctx, plot.x(i + 1), plot.y(value), 2.5, frame.palette.marker);
                        },
                    );
                });
            });
        },
    });
}

export const acf = correlogram(false);
export const pacf = correlogram(true);

export const lag = defineFigure({
    duration: TIMES.duration,
    height: 320,
    decode(raw) {
        const p = obj(raw, "props");
        const values = sample(p.values, "props.values", 4);
        const lag =
            p.lag === undefined ? 1 : bounded(p.lag, "props.lag", 1, values.length - 2, true);
        const data = values.slice(lag).map((v, i) => ({ x: values[i] ?? 0, y: v }));
        return { ...common(p, "Lag scatter plot"), data, lag, domain: extent(values) };
    },
    draw(frame, p) {
        header(frame, p.title, `lag=${String(p.lag)} · pairs=${String(p.data.length)}`);
        const plot = axes(frame, p.domain, p.domain, {
            xLabel: `value at t − ${String(p.lag)}`,
            yLabel: "value at t",
        });
        points(frame, plot, p.data);
    },
});
