/** Relationships, binned density, scatter matrices, and agreement. */
import {
    arr,
    defineFigure,
    fitAspect,
    line,
    maybe,
    mean,
    obj,
    progress,
    str,
    withAlpha,
} from "#src/figures/kit.ts";
import { densityContours, hexBins, histogram, linearFit, variance } from "#src/figures/statistics/math.ts";
import {
    axes,
    bool,
    bounded,
    clipped,
    common,
    curve,
    extent,
    fittedText,
    fmt,
    header,
    points,
    readPoints,
    reference,
    sample,
    TIMES,
    type Domain,
} from "#src/figures/statistics/shared.ts";

export const scatter = defineFigure({
    duration: TIMES.duration,
    height: 320,
    decode(raw) {
        const p = obj(raw, "props");
        const data = readPoints(p);
        const fit = bool(p.fit, "props.fit") ? linearFit(data) : undefined;
        return {
            ...common(p, "Scatter plot"),
            data,
            fit,
            xd: extent(data.map((d) => d.x)),
            yd: extent(data.map((d) => d.y)),
            xLabel: maybe(p.xLabel, "props.xLabel", str) ?? "x",
            yLabel: maybe(p.yLabel, "props.yLabel", str) ?? "y",
        };
    },
    draw(frame, p) {
        header(
            frame,
            p.title,
            p.fit
                ? `n=${String(p.data.length)} · OLS R²=${fmt(p.fit.r2)}`
                : `n=${String(p.data.length)}`,
        );
        const plot = axes(frame, p.xd, p.yd, { xLabel: p.xLabel, yLabel: p.yLabel });
        points(frame, plot, p.data);
        if (p.fit) {
            const fit = p.fit;
            curve(
                frame,
                plot,
                p.xd.map((x) => ({ x, y: fit.intercept + fit.slope * x })),
                frame.palette.inkStrong,
                progress(frame.time, 2.5, 1.5),
            );
        }
    },
});

export const hexbin = defineFigure({
    duration: TIMES.duration,
    height: 320,
    heightFor: (width) => Math.max(250, ((width - 64) * Math.sqrt(3)) / 2 + 104),
    decode(raw) {
        const p = obj(raw, "props");
        const data = readPoints(p);
        const xd = extent(data.map((d) => d.x));
        const yd = extent(data.map((d) => d.y));
        const bins = hexBins(
            data,
            xd,
            yd,
            p.bins === undefined ? 12 : bounded(p.bins, "props.bins", 4, 30, true),
        );
        return {
            ...common(p, "Hexbin plot"),
            xd,
            yd,
            bins,
            max: Math.max(...bins.map((b) => b.count)),
            n: data.length,
        };
    },
    draw(frame, p) {
        header(
            frame,
            p.title,
            `n=${String(p.n)} · max bin=${String(p.max)} · darker = more observations`,
        );
        const available = { x: 48, y: 60, w: frame.width - 64, h: frame.height - 104 };
        const rect = fitAspect(available, Math.sqrt(3), 1.5);
        const plot = axes(frame, p.xd, p.yd, { rect, xLabel: "x", yLabel: "y" });
        clipped(frame, plot.rect, () => {
            p.bins.forEach((bin, i) => {
                withAlpha(
                    frame.ctx,
                    progress(frame.time, TIMES.start + (i / p.bins.length) * TIMES.reveal, 0.3),
                    () => {
                        frame.ctx.beginPath();
                        bin.vertices.forEach((v, j) => {
                            if (j === 0) {
                                frame.ctx.moveTo(plot.x(v.x), plot.y(v.y));
                            }
                            else {
                                frame.ctx.lineTo(plot.x(v.x), plot.y(v.y));
                            }
                        });
                        frame.ctx.closePath();
                        frame.ctx.fillStyle = frame.palette.surface;
                        frame.ctx.fill();
                        withAlpha(frame.ctx, 0.12 + (bin.count / p.max) * 0.88, () => {
                            frame.ctx.fillStyle = frame.palette.marker;
                            frame.ctx.fill();
                        });
                        frame.ctx.strokeStyle = frame.palette.paper;
                        frame.ctx.lineWidth = 0.7;
                        frame.ctx.stroke();
                    },
                );
            });
        });
    },
});

export const densityContour = defineFigure({
    duration: TIMES.duration,
    height: 320,
    decode(raw) {
        const p = obj(raw, "props");
        const data = readPoints(p, 3);
        const xd = extent(
            data.map((d) => d.x),
            0.25,
        );
        const yd = extent(
            data.map((d) => d.y),
            0.25,
        );
        const factor = data.length ** (-1 / 6);
        const hx =
            p.bandwidthX === undefined
                ? (Math.sqrt(variance(data.map((d) => d.x))) || (xd[1] - xd[0]) / 5) * factor
                : bounded(p.bandwidthX, "props.bandwidthX", Number.MIN_VALUE, 1e12);
        const hy =
            p.bandwidthY === undefined
                ? (Math.sqrt(variance(data.map((d) => d.y))) || (yd[1] - yd[0]) / 5) * factor
                : bounded(p.bandwidthY, "props.bandwidthY", Number.MIN_VALUE, 1e12);
        return {
            ...common(p, "2D kernel density contours"),
            data,
            xd,
            yd,
            contours: densityContours(data, xd, yd, hx, hy),
        };
    },
    draw(frame, p) {
        header(frame, p.title, "contours: 15%, 35%, 60%, 85% of peak density");
        const plot = axes(frame, p.xd, p.yd, { xLabel: "x", yLabel: "y" });
        points(frame, plot, p.data, frame.palette.inkFaint, 1.8);
        clipped(frame, plot.rect, () => {
            p.contours.forEach((contour, i) => {
                withAlpha(frame.ctx, progress(frame.time, 1.3 + i * 0.7, 0.6), () => {
                    for (const [a, b] of contour.segments)
                    {
                        line(
                            frame.ctx,
                            plot.x(a.x),
                            plot.y(a.y),
                            plot.x(b.x),
                            plot.y(b.y),
                            i === p.contours.length - 1
                                ? frame.palette.marker
                                : frame.palette.inkMuted,
                            1.2 + i * 0.4,
                        );
                    }
                });
            });
        });
    },
});

export const pairplot = defineFigure({
    duration: TIMES.duration,
    height: 500,
    heightFor: (width) => width + 40,
    decode(raw) {
        const p = obj(raw, "props");
        const columns = arr(p.columns, "props.columns").map((c, i) =>
            str(c, `props.columns[${String(i)}]`),
        );
        if (columns.length < 2 || columns.length > 5 || new Set(columns).size !== columns.length)
        {
            throw new Error("props.columns needs 2–5 unique variable names");
        }
        const rows = arr(p.rows, "props.rows").map((r, i) =>
            sample(r, `props.rows[${String(i)}]`, columns.length, columns.length),
        );
        if (rows.length < 3 || rows.length > 500)
        {
            throw new Error("props.rows needs 3–500 observations");
        }
        const domains = columns.map((_, i) => extent(rows.map((r) => r[i] ?? 0)));
        const histograms = columns.map((_, i) =>
            histogram(
                rows.map((r) => r[i] ?? 0),
                domains[i] ?? [0, 1],
                10,
            ),
        );
        return { ...common(p, "Scatterplot matrix"), columns, rows, domains, histograms };
    },
    draw(frame, p) {
        header(frame, p.title, `n=${String(p.rows.length)} · diagonal: marginal histograms`);
        const n = p.columns.length;
        const tile = Math.min((frame.width - 44) / n, (frame.height - 96) / n);
        const top = 66;
        for (let r = 0; r < n; r++)
        {
            for (let c = 0; c < n; c++) {
                const rect = {
                    x: 40 + c * tile + 3,
                    y: top + r * tile + 3,
                    w: tile - 8,
                    h: tile - 8,
                };
                const xd: Domain = p.domains[c] ?? [0, 1];
                const yd: Domain = p.domains[r] ?? [0, 1];
                line(
                    frame.ctx,
                    rect.x,
                    rect.y + rect.h,
                    rect.x + rect.w,
                    rect.y + rect.h,
                    frame.palette.rule,
                );
                line(frame.ctx, rect.x, rect.y, rect.x, rect.y + rect.h, frame.palette.rule);
                if (r === 0)
                {
                    fittedText(
                        frame,
                        p.columns[c] ?? "",
                        rect.x + rect.w / 2,
                        top - 5,
                        rect.w,
                        frame.palette.inkStrong,
                        "center",
                    );
                }
                if (c === 0)
                {
                    fittedText(
                        frame,
                        p.columns[r] ?? "",
                        0,
                        rect.y + rect.h / 2 + 4,
                        35,
                        frame.palette.inkMuted,
                    );
                }
                if (r === n - 1) {
                    fittedText(
                        frame,
                        fmt(xd[0]),
                        rect.x,
                        rect.y + rect.h + 15,
                        rect.w / 2,
                        frame.palette.inkFaint,
                    );
                    fittedText(
                        frame,
                        fmt(xd[1]),
                        rect.x + rect.w,
                        rect.y + rect.h + 15,
                        rect.w / 2,
                        frame.palette.inkFaint,
                        "right",
                    );
                }
                const plot = {
                    rect,
                    x: (x: number) => rect.x + ((x - xd[0]) / (xd[1] - xd[0])) * rect.w,
                    y: (y: number) => rect.y + rect.h - ((y - yd[0]) / (yd[1] - yd[0])) * rect.h,
                };
                if (r !== c)
                {
                    points(
                        frame,
                        plot,
                        p.rows.map((row) => ({ x: row[c] ?? 0, y: row[r] ?? 0 })),
                        frame.palette.marker,
                        frame.width < 520 ? 1.4 : 2,
                    );
                }
                else {
                    const counts = p.histograms[r] ?? [];
                    const max = Math.max(...counts);
                    withAlpha(frame.ctx, progress(frame.time, TIMES.start, 1), () => {
                        counts.forEach((count, i) => {
                            frame.ctx.fillStyle = frame.palette.inkMuted;
                            frame.ctx.fillRect(
                                rect.x + (i / counts.length) * rect.w,
                                rect.y + rect.h * (1 - count / max),
                                rect.w / counts.length - 1,
                                (count / max) * rect.h,
                            );
                        });
                    });
                }
            }
        }
    },
});

export const jointplot = defineFigure({
    duration: TIMES.duration,
    height: 380,
    decode(raw) {
        const p = obj(raw, "props");
        const data = readPoints(p);
        const xd = extent(data.map((d) => d.x));
        const yd = extent(data.map((d) => d.y));
        return {
            ...common(p, "Joint plot with marginal histograms"),
            data,
            xd,
            yd,
            hx: histogram(
                data.map((d) => d.x),
                xd,
                12,
            ),
            hy: histogram(
                data.map((d) => d.y),
                yd,
                12,
            ),
        };
    },
    draw(frame, p) {
        header(frame, p.title, `n=${String(p.data.length)} · marginal bins share the scatter axes`);
        const rect = { x: 48, y: 110, w: frame.width - 96, h: frame.height - 154 };
        const plot = axes(frame, p.xd, p.yd, { rect, xLabel: "x", yLabel: "y" });
        points(frame, plot, p.data);
        withAlpha(frame.ctx, progress(frame.time, TIMES.start, 1.3), () => {
            frame.ctx.fillStyle = frame.palette.inkMuted;
            p.hx.forEach((v, i) => {
                frame.ctx.fillRect(
                    rect.x + (i / p.hx.length) * rect.w,
                    rect.y - 16 - (v / Math.max(...p.hx)) * 32,
                    rect.w / p.hx.length - 1,
                    (v / Math.max(...p.hx)) * 32,
                );
            });
            p.hy.forEach((v, i) => {
                frame.ctx.fillRect(
                    rect.x + rect.w + 8,
                    rect.y + rect.h - ((i + 1) / p.hy.length) * rect.h,
                    (v / Math.max(...p.hy)) * 27,
                    rect.h / p.hy.length - 1,
                );
            });
        });
    },
});

export const blandAltman = defineFigure({
    duration: TIMES.duration,
    height: 320,
    decode(raw) {
        const p = obj(raw, "props");
        const pairs = readPoints(p, 3);
        const data = pairs.map((p) => ({ x: (p.x + p.y) / 2, y: p.y - p.x }));
        const bias = mean(data.map((p) => p.y));
        const sd = Math.sqrt(variance(data.map((p) => p.y)));
        const limits = [bias - 1.95996398454 * sd, bias + 1.95996398454 * sd];
        return {
            ...common(p, "Bland–Altman agreement plot"),
            data,
            bias,
            limits,
            xd: extent(data.map((p) => p.x)),
            yd: extent([...data.map((p) => p.y), ...limits]),
        };
    },
    draw(frame, p) {
        header(frame, p.title, `bias=${fmt(p.bias)} · 95% LoA: ${p.limits.map(fmt).join(" to ")}`);
        const plot = axes(frame, p.xd, p.yd, {
            xLabel: "mean of paired measurements",
            yLabel: "second − first",
        });
        points(frame, plot, p.data);
        withAlpha(frame.ctx, progress(frame.time, 2.6, 1), () => {
            for (const value of [p.bias, ...p.limits])
            {
                reference(
                    frame,
                    plot,
                    { x: p.xd[0], y: value },
                    { x: p.xd[1], y: value },
                    value === p.bias ? frame.palette.inkStrong : frame.palette.warn,
                );
            }
        });
    },
});
