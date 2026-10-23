/** Box/violin/swarm/raincloud/boxen, KDE/ECDF/ridges and Q–Q/P–P. */
import {
    defineFigure,
    box,
    dot,
    line,
    maybe,
    mean,
    num,
    obj,
    progress,
    str,
    withAlpha,
    type Frame,
    type Point,
} from "#src/figures/kit.ts";
import {
    bandwidth,
    boxSummary,
    density,
    ecdf as empirical,
    normalCdf,
    normalQuantile,
    quantile,
    variance,
} from "#src/figures/statistics/math.ts";
import {
    axes,
    bounded,
    clipped,
    common,
    curve,
    extent,
    fittedText,
    fmt,
    header,
    legend,
    points,
    readGroups,
    reference,
    sample,
    swarmPositions,
    TIMES,
    type Domain,
    type Group,
    type Plot,
} from "#src/figures/statistics/shared.ts";

interface DistributionProps {
    title: string;
    unit: string;
    groups: (Group & { box: ReturnType<typeof boxSummary>; density: Point[] })[];
    domain: Domain;
    peak: number;
}

function decodeGroups(raw: Parameters<typeof obj>[0], title: string): DistributionProps {
    const p = obj(raw, "props");
    const groups = readGroups(p);
    const specified = maybe(p.bandwidth, "props.bandwidth", num);
    if (specified !== undefined && (specified <= 0 || specified > 1e12))
    {
        throw new Error("props.bandwidth must be positive and at most 1e12");
    }
    const hs = groups.map((g) => specified ?? bandwidth(g.values));
    const domain: Domain = [
        Math.min(...groups.map((g, i) => (g.values[0] ?? 0) - 3 * (hs[i] ?? 1))),
        Math.max(...groups.map((g, i) => (g.values.at(-1) ?? 0) + 3 * (hs[i] ?? 1))),
    ];
    const prepared = groups.map((g, i) => ({
        ...g,
        box: boxSummary(g.values),
        density: density(g.values, domain, hs[i] ?? 1),
    }));
    if (
        prepared.some(
            (g) => !g.density.every((d) => Number.isFinite(d.y)) || !g.density.some((d) => d.y > 0),
        )
    )
    {
        throw new Error("props.bandwidth is too small for a finite, resolved density curve");
    }
    return {
        ...common(p, title),
        unit: maybe(p.unit, "props.unit", str) ?? "value",
        groups: prepared,
        domain,
        peak: Math.max(...prepared.flatMap((g) => g.density.map((d) => d.y))),
    };
}

type GroupStyle = "boxplot" | "violin" | "beeswarm" | "raincloud" | "boxen";
function grouped(style: GroupStyle, title: string) {
    return defineFigure<DistributionProps>({
        duration: TIMES.duration,
        height: 330,
        decode: (raw) => decodeGroups(raw, title),
        draw(frame, props) {
            const { ctx, palette, time } = frame;
            header(
                frame,
                props.title,
                props.groups
                    .map(
                        (g) =>
                            `${g.label}: n=${String(g.values.length)}, median=${fmt(g.box.median)}`,
                    )
                    .join(" · "),
            );
            const plot = axes(frame, [0, props.groups.length], props.domain, {
                xTicks: false,
                yLabel: props.unit,
            });
            const lane = plot.rect.w / props.groups.length;
            props.groups.forEach((g, i) => {
                const x = plot.x(i + 0.5);
                const color = i === 0 ? palette.marker : palette.inkMuted;
                fittedText(
                    frame,
                    g.label,
                    x,
                    plot.rect.y + plot.rect.h + 19,
                    lane - 4,
                    color,
                    "center",
                );
                const shown = progress(time, TIMES.start + i * 0.2, 1.4);
                clipped(frame, plot.rect, () => {
                    withAlpha(ctx, shown, () => {
                        if (style === "violin" || style === "raincloud") {
                            const peak = Math.max(...g.density.map((p) => p.y));
                            const half = lane * (style === "raincloud" ? 0.38 : 0.4);
                            const left = g.density.map((p) => ({
                                x: x - (p.y / peak) * half,
                                y: plot.y(p.x),
                            }));
                            const right = [...g.density]
                                .reverse()
                                .map((p) => ({
                                    x: style === "raincloud" ? x : x + (p.y / peak) * half,
                                    y: plot.y(p.x),
                                }));
                            polygon(frame, [...left, ...right], color);
                        }
                        if (style === "boxen") {
                            const levels = Math.min(
                                5,
                                Math.max(1, Math.floor(Math.log2(g.values.length)) - 2),
                            );
                            for (let k = levels; k >= 1; k--) {
                                const tail = 0.5 ** (k + 1);
                                const a = quantile(g.values, tail);
                                const b = quantile(g.values, 1 - tail);
                                const w = (lane * 0.65) / k;
                                withAlpha(ctx, 0.25 + 0.6 / k, () => {
                                    box(
                                        ctx,
                                        x - w / 2,
                                        plot.y(b),
                                        w,
                                        Math.max(1, plot.y(a) - plot.y(b)),
                                        0,
                                        color,
                                        color,
                                    );
                                });
                            }
                            for (const v of g.values.filter(
                                (v) =>
                                    v < quantile(g.values, 0.5 ** (levels + 1)) ||
                                    v > quantile(g.values, 1 - 0.5 ** (levels + 1)),
                            ))
                            {
                                dot(ctx, x, plot.y(v), 2, color);
                            }
                        }
                        if (style === "boxplot" || style === "violin" || style === "raincloud")
                        {
                            drawBox(
                                frame,
                                plot,
                                g.box,
                                x,
                                lane * (style === "boxplot" ? 0.52 : 0.14),
                                color,
                                style === "boxplot",
                            );
                        }
                        if (style === "boxen")
                        {
                            line(
                                ctx,
                                x - lane * 0.3,
                                plot.y(g.box.median),
                                x + lane * 0.3,
                                plot.y(g.box.median),
                                palette.inkStrong,
                                2,
                            );
                        }
                    });
                });
                if (style === "beeswarm" || style === "raincloud") {
                    const half = lane * (style === "raincloud" ? 0.15 : 0.4);
                    const radius = Math.min(2.8, Math.max(0.8, half / Math.sqrt(g.values.length)));
                    const packed = swarmPositions(g.values, plot.y, radius, half);
                    const base = style === "raincloud" ? x + lane * 0.26 : x;
                    clipped(frame, plot.rect, () => {
                        packed.forEach((p, j) => {
                            withAlpha(
                                ctx,
                                progress(
                                    time,
                                    TIMES.start + (j / packed.length) * TIMES.reveal,
                                    0.25,
                                ),
                                () => {
                                    dot(ctx, base + p.x, p.y, radius, color);
                                },
                            );
                        });
                    });
                }
            });
        },
    });
}

function polygon(frame: Frame, vertices: Point[], color: string) {
    const { ctx } = frame;
    ctx.beginPath();
    vertices.forEach((p, i) => {
        if (i === 0) {
            ctx.moveTo(p.x, p.y);
        }
        else {
            ctx.lineTo(p.x, p.y);
        }
    });
    ctx.closePath();
    withAlpha(ctx, 0.2, () => {
        ctx.fillStyle = color;
        ctx.fill();
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawBox(
    frame: Frame,
    plot: Plot,
    b: ReturnType<typeof boxSummary>,
    x: number,
    w: number,
    color: string,
    outliers: boolean,
) {
    const { ctx, palette } = frame;
    line(ctx, x, plot.y(b.low), x, plot.y(b.high), color, 1.5);
    for (const value of [b.low, b.high])
    {
        line(ctx, x - w * 0.25, plot.y(value), x + w * 0.25, plot.y(value), color, 1.5);
    }
    box(
        ctx,
        x - w / 2,
        plot.y(b.q3),
        w,
        Math.max(1, plot.y(b.q1) - plot.y(b.q3)),
        0,
        palette.paper,
        color,
        1.5,
    );
    line(ctx, x - w / 2, plot.y(b.median), x + w / 2, plot.y(b.median), color, 2.5);
    if (outliers) {
        for (const value of b.outliers) {
            dot(ctx, x, plot.y(value), 2.8, color);
        }
    }
}

export const boxplot = grouped("boxplot", "Box plot · Tukey 1.5 IQR");
export const violin = grouped("violin", "Violin plot · Gaussian KDE");
export const beeswarm = grouped("beeswarm", "Beeswarm plot");
export const raincloud = grouped("raincloud", "Raincloud plot");
export const boxen = grouped("boxen", "Boxen · letter-value plot");

function distributionCurve(style: "kde" | "ecdf" | "ridgeline", title: string) {
    return defineFigure<DistributionProps>({
        duration: TIMES.duration,
        height: 320,
        heightFor: (_w, p) => (style === "ridgeline" ? 100 + p.groups.length * 66 : 320),
        decode: (raw) => decodeGroups(raw, title),
        draw(frame, props) {
            header(frame, props.title, "");
            legend(
                frame,
                props.groups.map((g) => g.label),
            );
            const ridge = style === "ridgeline";
            const yd: Domain = ridge
                ? [0, props.groups.length + 0.1]
                : style === "ecdf"
                    ? [0, 1.04]
                    : [0, props.peak * 1.12];
            const plot = axes(frame, props.domain, yd, {
                xLabel: props.unit,
                yTicks: !ridge,
                yLabel: ridge ? "groups" : style === "ecdf" ? "cumulative probability" : "density",
            });
            props.groups.forEach((g, i) => {
                const color = i === 0 ? frame.palette.marker : frame.palette.inkMuted;
                let data =
                    style === "ecdf"
                        ? [
                            { x: props.domain[0], y: 0 },
                            ...empirical(g.values),
                            { x: props.domain[1], y: 1 },
                        ]
                        : g.density;
                if (ridge) {
                    const base = props.groups.length - i - 0.85;
                    const peak = Math.max(...g.density.map((d) => d.y));
                    data = g.density.map((d) => ({ x: d.x, y: base + (d.y / peak) * 0.85 }));
                    fittedText(
                        frame,
                        g.label,
                        plot.rect.x + 3,
                        plot.y(base) - 4,
                        plot.rect.w / 3,
                        color,
                    );
                }
                curve(
                    frame,
                    plot,
                    data,
                    color,
                    progress(frame.time, TIMES.curveStart + i * TIMES.curveGap, TIMES.curveReveal),
                    2,
                    i === 0 || ridge ? [] : [i + 1, 3],
                );
            });
        },
    });
}

export const kde = distributionCurve("kde", "Kernel density estimate");
export const ecdf = distributionCurve("ecdf", "Empirical cumulative distribution");
export const ridgeline = distributionCurve("ridgeline", "Ridgeline distributions");

function probabilityPlot(style: "qq" | "pp") {
    return defineFigure<{
        title: string;
        data: Point[];
        xd: Domain;
        yd: Domain;
        reference: [Point, Point];
        summary: string;
    }>({
        duration: TIMES.duration,
        height: 320,
        decode(raw) {
            const p = obj(raw, "props");
            const values = sample(p.samples, "props.samples").sort((a, b) => a - b);
            const referenceSample =
                p.reference === undefined
                    ? undefined
                    : sample(p.reference, "props.reference").sort((a, b) => a - b);
            const m =
                p.mean === undefined ? mean(values) : bounded(p.mean, "props.mean", -1e12, 1e12);
            const sd =
                p.sd === undefined
                    ? Math.sqrt(variance(values))
                    : bounded(p.sd, "props.sd", Number.MIN_VALUE, 1e12);
            if (!referenceSample && sd === 0)
            {
                throw new Error(
                    "props.samples must vary for a fitted normal reference, or set props.sd",
                );
            }
            let data: Point[];
            let ref: [Point, Point];
            if (style === "qq") {
                const n = Math.min(300, Math.max(values.length, referenceSample?.length ?? 0));
                data = Array.from({ length: n }, (_, i) => {
                    const at = (i + 0.5) / n;
                    return {
                        x: referenceSample
                            ? quantile(referenceSample, at)
                            : m + sd * normalQuantile(at),
                        y: quantile(values, at),
                    };
                });
                const d = extent(data.flatMap((v) => [v.x, v.y]));
                ref = [
                    { x: d[0], y: d[0] },
                    { x: d[1], y: d[1] },
                ];
            } else {
                const combined = [...new Set([...values, ...(referenceSample ?? [])])].sort(
                    (a, b) => a - b,
                );
                data = combined.map((v) => ({
                    x: referenceSample
                        ? referenceSample.filter((r) => r <= v).length / referenceSample.length
                        : normalCdf((v - m) / sd),
                    y: values.filter((s) => s <= v).length / values.length,
                }));
                ref = [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ];
            }
            const domain: Domain =
                style === "pp" ? [0, 1] : extent(data.flatMap((d) => [d.x, d.y]));
            return {
                ...common(p, style === "qq" ? "Q–Q plot" : "P–P plot"),
                data,
                xd: domain,
                yd: domain,
                reference: ref,
                summary: referenceSample
                    ? "two samples · identity reference"
                    : `normal reference · mean=${fmt(m)}, sd=${fmt(sd)}`,
            };
        },
        draw(frame, props) {
            header(frame, props.title, props.summary);
            const plot = axes(frame, props.xd, props.yd, {
                xLabel: style === "qq" ? "reference quantile" : "reference CDF",
                yLabel: style === "qq" ? "sample quantile" : "empirical CDF",
            });
            reference(frame, plot, ...props.reference);
            points(frame, plot, props.data);
        },
    });
}

export const qq = probabilityPlot("qq");
export const pp = probabilityPlot("pp");
