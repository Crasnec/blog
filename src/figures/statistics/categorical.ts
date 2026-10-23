import { arr, defineFigure, obj, progress, str, withAlpha } from "#src/figures/kit.ts";
import { bounded, common, fittedText, fmt, header, TIMES } from "#src/figures/statistics/shared.ts";

export const mosaic = defineFigure({
    duration: TIMES.duration,
    height: 340,
    decode(raw) {
        const p = obj(raw, "props");
        const rows = arr(p.rows, "props.rows").map((s, i) => str(s, `props.rows[${String(i)}]`));
        const cols = arr(p.cols, "props.cols").map((s, i) => str(s, `props.cols[${String(i)}]`));
        if (rows.length < 2 || rows.length > 8 || cols.length < 2 || cols.length > 8)
        {
            throw new Error("props.rows and props.cols need 2–8 labels each");
        }
        const counts = arr(p.counts, "props.counts").map((row, r) =>
            arr(row, `props.counts[${String(r)}]`).map((n, c) =>
                bounded(n, `props.counts[${String(r)}][${String(c)}]`, 0, 1e9, true),
            ),
        );
        if (counts.length !== rows.length || counts.some((r) => r.length !== cols.length))
        {
            throw new Error("props.counts must match rows × cols");
        }
        const rowTotals = counts.map((row) => row.reduce((a, b) => a + b, 0));
        const colTotals = cols.map((_, c) => counts.reduce((a, row) => a + (row[c] ?? 0), 0));
        if ([...rowTotals, ...colTotals].some((v) => v === 0))
        {
            throw new Error("props.counts cannot have an empty row or column margin");
        }
        const total = rowTotals.reduce((a, b) => a + b, 0);
        const cells = cols.flatMap((_, c) =>
            rows.map((_, r) => {
                const observed = counts[r]?.[c] ?? 0;
                const expected = ((rowTotals[r] ?? 0) * (colTotals[c] ?? 0)) / total;
                return { r, c, observed, residual: (observed - expected) / Math.sqrt(expected) };
            }),
        );
        return { ...common(p, "Mosaic plot"), rows, cols, cells, colTotals, total };
    },
    draw(frame, p) {
        header(frame, p.title, `n=${fmt(p.total)} · Pearson residual: marker (+), danger (−)`);
        const rect = { x: 4, y: 56, w: frame.width - 8, h: frame.height - 100 };
        let x = rect.x;
        for (const [c, label] of p.cols.entries()) {
            const colTotal = p.colTotals[c] ?? 1;
            const w = (rect.w * colTotal) / p.total;
            let y = rect.y;
            fittedText(
                frame,
                label,
                x + w / 2,
                rect.y + rect.h + 19,
                Math.max(0, w - 4),
                frame.palette.inkMuted,
                "center",
            );
            for (const cell of p.cells.filter((cell) => cell.c === c)) {
                const h = (rect.h * cell.observed) / colTotal;
                // Reveal colour over a complete scaffold, rather than leaving
                // the later columns looking like unused canvas.
                frame.ctx.fillStyle = frame.palette.ruleFaint;
                frame.ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
                withAlpha(
                    frame.ctx,
                    progress(frame.time, TIMES.start + (c / p.cols.length) * TIMES.reveal, 0.6),
                    () => {
                        frame.ctx.fillStyle = frame.palette.surface;
                        frame.ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
                        withAlpha(
                            frame.ctx,
                            0.15 + Math.min(1, Math.abs(cell.residual) / 4) * 0.7,
                            () => {
                                frame.ctx.fillStyle =
                                    cell.residual >= 0
                                        ? frame.palette.marker
                                        : frame.palette.danger;
                                frame.ctx.fillRect(
                                    x + 1,
                                    y + 1,
                                    Math.max(0, w - 2),
                                    Math.max(0, h - 2),
                                );
                            },
                        );
                        if (w > 35 && h > 32) {
                            fittedText(
                                frame,
                                p.rows[cell.r] ?? "",
                                x + w / 2,
                                y + h / 2 - 2,
                                w - 8,
                                frame.palette.inkStrong,
                                "center",
                            );
                            fittedText(
                                frame,
                                String(cell.observed),
                                x + w / 2,
                                y + h / 2 + 13,
                                w - 8,
                                frame.palette.inkStrong,
                                "center",
                            );
                        }
                    },
                );
                y += h;
            }
            x += w;
        }
    },
});
