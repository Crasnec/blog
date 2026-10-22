/**
 * heatmap — a matrix of values, coloured from quiet to hot.
 *
 * For "when and where is it bad": latency by weekday and hour, errors by
 * service and region, load by shard and minute. Cells sweep in column by
 * column, the way the hours pass; the hottest few are then outlined and
 * listed with their values beside the legend (never on the grid, where a
 * label would hide the cells next to it), and the header ends on the single
 * worst cell as a value.
 *
 *   <Figure kind="heatmap" props={{
 *     rows: ["Mon", "Tue", "Wed"],
 *     cols: ["00:00", "01:00", "02:00"],
 *     values: [[120, 90, 80], [130, 95, 85], [125, 100, 90]],
 *     unit: "ms",
 *     highlight: 2,
 *   }} />
 *
 * Typing 168 numbers by hand is no fun, so `values` may instead be a
 * generator, `{ model: "daily-peak", ... }`, which builds a realistic
 * weekday × hour matrix through `presets/daily-peak.ts`. New TSX components
 * use a numeric matrix; example generation stays with the post.
 *
 * The palette has one accent and no colour ramp, and its colours are oklch()
 * strings that cannot be mixed by arithmetic here. So the ramp is made by
 * compositing: each cell is filled with `surface`, then with `marker` at an
 * opacity equal to its value's place between the minimum and the maximum.
 * That follows light and dark mode, and any theme, for free.
 */

import {
    arr,
    box,
    defineFigure,
    ease,
    fittedText,
    formatNumber,
    label,
    line,
    maybe,
    num,
    nums,
    obj,
    progress,
    rampFill,
    str,
    text,
    withAlpha,
    type Frame,
    type Rect,
} from "../kit.ts";
import { dailyPeak } from "../presets/daily-peak.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    /** Grid outline and labels fade in. */
    appear: 0.5,
    /** The column sweep: first column starts at `sweep`, last ends `sweepFor` later. */
    sweep: 0.5,
    sweepFor: 3.2,
    /** Each cell fades in over this long once the sweep reaches it. */
    cellFade: 0.3,
    /** The hottest cells are outlined one after another from here. */
    highlight: 4,
    highlightGap: 0.35,
    /** The worst cell becomes the header's summary. */
    verdict: 5.2,
} as const;

const DURATION = 6.2;

/* — 2. data ———————————————————————————————————————————————————————— */

interface Props {
    rows: string[];
    cols: string[];
    /** rows × cols. */
    values: number[][];
    unit: string;
    lo: number;
    hi: number;
    title: string | undefined;
    /** The k hottest cells, hottest first. */
    top: { row: number; col: number; value: number }[];
}

const fmt = formatNumber;

/* — 3. props ———————————————————————————————————————————————————————— */

export default defineFigure<Props>({
    duration: DURATION,
    height: 300,
    heightFor: (width, props) => layoutHeights(width, props.rows.length, props.top.length).total,

    decode(raw) {
        const p = obj(raw, "props");
        const rows = arr(p.rows, "props.rows").map((v, i) => str(v, `props.rows[${String(i)}]`));
        const cols = arr(p.cols, "props.cols").map((v, i) => str(v, `props.cols[${String(i)}]`));
        if (rows.length < 1 || rows.length > 16)
            throw new Error("props.rows must have 1 to 16 labels");
        if (cols.length < 2 || cols.length > 48)
            throw new Error("props.cols must have 2 to 48 labels");

        let values: number[][];
        if (Array.isArray(p.values)) {
            values = arr(p.values, "props.values").map((row, r) =>
                nums(row, `props.values[${String(r)}]`),
            );
            if (values.length !== rows.length) {
                throw new Error(
                    `props.values has ${String(values.length)} rows but props.rows has ${String(rows.length)}`,
                );
            }
            for (const [r, row] of values.entries()) {
                if (row.length !== cols.length) {
                    throw new Error(
                        `props.values[${String(r)}] has ${String(row.length)} values but props.cols has ${String(cols.length)}`,
                    );
                }
            }
        } else {
            const spec = obj(p.values, "props.values");
            const model = str(spec.model, "props.values.model");
            if (model !== "daily-peak") throw new Error('props.values.model must be "daily-peak"');
            values = dailyPeak(spec, rows, cols, "props.values");
        }

        const flat = values.flatMap((row, r) => row.map((value, col) => ({ row: r, col, value })));
        const k = maybe(p.highlight, "props.highlight", num) ?? 3;
        if (!Number.isInteger(k) || k < 0 || k > 10)
            throw new Error("props.highlight must be a whole number from 0 to 10");
        let lo = maybe(p.min, "props.min", num) ?? Math.min(...flat.map((c) => c.value));
        let hi = maybe(p.max, "props.max", num) ?? Math.max(...flat.map((c) => c.value));
        if (hi === lo && p.min === undefined && p.max === undefined) {
            const padding = Math.max(1, Math.abs(lo) * 0.1);
            lo -= padding;
            hi += padding;
        }
        if (hi <= lo || !Number.isFinite(hi - lo))
            throw new Error("props.max must be above props.min with a finite range");

        return {
            rows,
            cols,
            values,
            unit: maybe(p.unit, "props.unit", str) ?? "",
            lo,
            hi,
            title: maybe(p.title, "props.title", str),
            top: [...flat].sort((a, b) => b.value - a.value).slice(0, k),
        };
    },

    draw(frame, props) {
        drawHeatmap(frame, props);
    },
});

/* — 4. drawing —————————————————————————————————————————————————————— */

/** Vertical layout for a width; shared by `heightFor` and `draw` so they agree. */
function layoutHeights(width: number, rowCount: number, ranked: number) {
    const narrow = width < 520;
    const header = narrow ? 44 : 30;
    const cellH = narrow ? 20 : 24;
    const grid = rowCount * cellH;
    const colLabels = 20;
    // The ranking sits beside the legend bar on a wide canvas, under it on a narrow one.
    const legend = narrow ? 36 + ranked * 17 : Math.max(36, ranked * 17 + 6);
    return {
        narrow,
        header,
        cellH,
        grid,
        colLabels,
        legend,
        total: header + grid + colLabels + legend + 6,
    };
}

function drawHeatmap(frame: Frame, props: Props) {
    const { ctx, width, time, palette } = frame;
    const L = layoutHeights(width, props.rows.length, props.top.length);
    ctx.font = `400 11px ${palette.sans}`;
    const rowLabelW = Math.min(
        width * 0.3,
        Math.max(L.narrow ? 22 : 30, ...props.rows.map((name) => ctx.measureText(name).width + 6)),
    );
    const gap = 2;
    const gridX = rowLabelW;
    const gridY = L.header;
    const cellW = (width - gridX - (props.cols.length - 1) * gap) / props.cols.length;
    const cellH = L.cellH - gap;
    const cell = (r: number, c: number): Rect => ({
        x: gridX + c * (cellW + gap),
        y: gridY + r * L.cellH,
        w: cellW,
        h: cellH,
    });
    const tOf = (v: number) => (v - props.lo) / (props.hi - props.lo);
    const appear = ease.out(progress(time, 0, TIMES.appear));
    const colStart = (c: number) => TIMES.sweep + (TIMES.sweepFor * c) / props.cols.length;

    withAlpha(ctx, appear, () => {
        /* layer 1: header */
        if (props.title)
            text(frame, props.title, 0, 14, { size: 12, weight: 700, color: palette.inkStrong });

        /* layer 2: cells — an empty track everywhere, the value once the sweep passes */
        for (const [r, row] of props.values.entries()) {
            for (const [c, v] of row.entries()) {
                const box_ = cell(r, c);
                // Not swept yet: a faint track, distinct from a quiet value.
                ctx.fillStyle = palette.ruleFaint;
                ctx.fillRect(box_.x, box_.y, box_.w, box_.h);
                const shown = ease.out(progress(time, colStart(c), TIMES.cellFade));
                if (shown > 0)
                    withAlpha(ctx, shown, () => {
                        rampFill(ctx, palette, box_, tOf(v));
                    });
            }
        }

        // The sweep's leading edge, while it is moving.
        const sweepEnd = TIMES.sweep + TIMES.sweepFor;
        if (time > TIMES.sweep && time < sweepEnd) {
            const x = gridX + ((time - TIMES.sweep) / TIMES.sweepFor) * (width - gridX);
            line(
                ctx,
                x,
                gridY - 4,
                x,
                gridY + props.rows.length * L.cellH + 2,
                palette.inkStrong,
                1.5,
            );
        }

        /* layer 3: labels — every row; columns as often as they fit */
        for (const [r, name] of props.rows.entries()) {
            const b = cell(r, 0);
            fittedText(frame, name, 0, b.y + b.h / 2 + 4, rowLabelW - 6);
        }
        ctx.font = `400 11px ${palette.mono}`;
        const widest = Math.max(...props.cols.map((c) => ctx.measureText(c).width));
        const every = Math.max(1, Math.ceil((widest + 6) / (cellW + gap)));
        // Thin categorical labels to a readable, repeatable spacing.
        const step = [1, 2, 3, 4, 6, 8, 12, 24].find((s) => s >= every) ?? every;
        const labelY = gridY + props.rows.length * L.cellH + 14;
        for (const [c, name] of props.cols.entries()) {
            if (c % step !== 0) continue;
            const b = cell(0, c);
            fittedText(frame, name, b.x, labelY, width - b.x, palette.inkFaint);
        }

        /* layer 4: legend — the ramp with its two ends as values */
        const legendY = labelY + 14;
        const legendW = Math.min(220, width - gridX);
        const segments = 24;
        for (let i = 0; i < segments; i++) {
            rampFill(
                ctx,
                palette,
                {
                    x: gridX + (legendW * i) / segments,
                    y: legendY,
                    w: legendW / segments + 0.5,
                    h: 8,
                },
                i / (segments - 1),
            );
        }
        text(frame, `${fmt(props.lo)}${props.unit}`, gridX, legendY + 22, {
            mono: true,
            size: 11,
            color: palette.inkFaint,
        });
        text(frame, `${fmt(props.hi)}${props.unit}`, gridX + legendW, legendY + 22, {
            mono: true,
            size: 11,
            color: palette.inkFaint,
            align: "right",
        });

        /*
         * layer 5: the hottest cells. On the grid they get an outline only;
         * their values and places are listed beside the legend, in rank order,
         * so nothing is drawn over a neighbouring cell.
         */
        const rankX = L.narrow ? gridX : gridX + legendW + 32;
        const rankY = L.narrow ? legendY + 44 : legendY + 8;
        for (const [i, hot] of props.top.entries()) {
            const shown = ease.out(progress(time, TIMES.highlight + i * TIMES.highlightGap, 0.35));
            if (shown <= 0) continue;
            const b = cell(hot.row, hot.col);
            withAlpha(ctx, shown, () => {
                box(ctx, b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3, 2, null, palette.inkStrong, 2);
                const y = rankY + i * 17;
                text(frame, String(i + 1), rankX, y, {
                    mono: true,
                    size: 11,
                    weight: 700,
                    color: palette.inkFaint,
                });
                text(frame, `${fmt(hot.value)}${props.unit}`, rankX + 16, y, {
                    mono: true,
                    size: 11,
                    weight: 700,
                    color: palette.inkStrong,
                });
                text(
                    frame,
                    `${props.rows[hot.row] ?? ""} ${props.cols[hot.col] ?? ""}`,
                    rankX + 80,
                    y,
                    { size: 11, color: palette.inkMuted },
                );
            });
        }

        /* layer 6: header value — running maximum during the sweep, then the verdict */
        const right = width;
        const headerY = L.narrow ? 34 : 14;
        if (time >= TIMES.verdict) {
            const worst = props.top[0];
            if (worst) {
                withAlpha(ctx, ease.out(progress(time, TIMES.verdict, 0.4)), () => {
                    label(
                        frame,
                        `Peak ${fmt(worst.value)}${props.unit} · ${props.rows[worst.row] ?? ""} ${props.cols[worst.col] ?? ""}`,
                        right,
                        headerY,
                        {
                            size: 12,
                            weight: 700,
                            mono: true,
                            color: palette.marker,
                            maxX: right,
                        },
                    );
                });
            }
        } else {
            let seen = -Infinity;
            for (const row of props.values) {
                for (const [c, v] of row.entries()) {
                    if (time >= colStart(c) && v > seen) seen = v;
                }
            }
            const message = Number.isFinite(seen)
                ? `Peak so far ${fmt(seen)}${props.unit}`
                : "Starting";
            label(frame, message, right, headerY, {
                size: 11,
                mono: true,
                color: palette.inkFaint,
                maxX: right,
            });
        }
    });
}
