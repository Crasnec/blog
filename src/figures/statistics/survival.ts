import { arr, defineFigure, line, obj, progress, str, withAlpha, type Point } from "#src/figures/kit.ts";
import { kaplanMeier } from "#src/figures/statistics/math.ts";
import { axes, bool, bounded, clipped, common, curve, header, legend, TIMES } from "#src/figures/statistics/shared.ts";

export const kaplanMeierFigure = defineFigure({
    duration: TIMES.duration,
    height: 350,
    decode(raw) {
        const p = obj(raw, "props");
        const groups = arr(p.groups, "props.groups").map((v, i) => {
            const path = `props.groups[${String(i)}]`;
            const group = obj(v, path);
            const observations = arr(group.observations, `${path}.observations`).map((d, j) => {
                const at = `${path}.observations[${String(j)}]`;
                const point = obj(d, at);
                if (point.event === undefined)
                {
                    throw new Error(`${at}.event must be true (event) or false (censored)`);
                }
                return {
                    time: bounded(point.time, `${at}.time`, 0, 1e12),
                    event: bool(point.event, `${at}.event`),
                };
            });
            if (observations.length < 1 || observations.length > 2000)
            {
                throw new Error(`${path}.observations needs 1–2000 observations`);
            }
            return {
                label: str(group.label, `${path}.label`),
                steps: kaplanMeier(observations),
                n: observations.length,
            };
        });
        if (groups.length < 1 || groups.length > 6)
        {
            throw new Error("props.groups needs 1–6 survival groups");
        }
        return {
            ...common(p, "Kaplan–Meier · log-log Greenwood 95% bands"),
            groups,
            end: Math.max(1, ...groups.flatMap((g) => g.steps.map((s) => s.time))) * 1.04,
        };
    },
    draw(frame, p) {
        header(frame, p.title, "");
        legend(
            frame,
            p.groups.map((g) => `${g.label} (n=${String(g.n)})`),
        );
        const plot = axes(frame, [0, p.end], [0, 1.03], {
            xLabel: "time · tick marks = censored",
            yLabel: "survival probability",
        });
        p.groups.forEach((g, index) => {
            const color = index === 0 ? frame.palette.marker : frame.palette.inkMuted;
            const stepPoints = (field: "survival" | "low" | "high"): Point[] =>
                g.steps.flatMap((s, i) => {
                    const prev = g.steps[i - 1];
                    return prev
                        ? [
                            { x: s.time, y: prev[field] },
                            { x: s.time, y: s[field] },
                        ]
                        : [{ x: s.time, y: s[field] }];
                });
            const revealed = {
                ...plot.rect,
                w: plot.rect.w * progress(frame.time, TIMES.start, TIMES.reveal),
            };
            clipped(frame, revealed, () => {
                withAlpha(frame.ctx, progress(frame.time, 2, 1) * 0.1, () => {
                    const band = [...stepPoints("high"), ...stepPoints("low").reverse()];
                    frame.ctx.beginPath();
                    band.forEach((v, i) => {
                        if (i === 0) {
                            frame.ctx.moveTo(plot.x(v.x), plot.y(v.y));
                        }
                        else {
                            frame.ctx.lineTo(plot.x(v.x), plot.y(v.y));
                        }
                    });
                    frame.ctx.closePath();
                    frame.ctx.fillStyle = color;
                    frame.ctx.fill();
                });
            });
            clipped(frame, revealed, () => {
                curve(
                    frame,
                    plot,
                    stepPoints("survival"),
                    color,
                    1,
                    2,
                    index === 0 ? [] : [index + 1, 3],
                );
            });
            clipped(frame, plot.rect, () => {
                g.steps.forEach((s) => {
                    if (
                        s.censored === 0 ||
                        frame.time < TIMES.start + (s.time / p.end) * TIMES.reveal
                    )
                    {
                        return;
                    }
                    line(
                        frame.ctx,
                        plot.x(s.time),
                        plot.y(s.survival) - 4,
                        plot.x(s.time),
                        plot.y(s.survival) + 4,
                        color,
                        1.5,
                    );
                });
            });
        });
    },
});
