/**
 * Server-rendered TSX entry point for the shared canvas runtime.
 * Import directly in MDX or compose it inside a post-specific TSX component.
 * No client directive is needed: src/figures/runtime.ts owns the animation.
 */
import type { CSSProperties } from "react";
import { t } from "#src/strings.ts";
import type { DefinedFigure } from "#src/figures/kit.ts";
import { prepareFigure, type FigureProps } from "#src/figures/element.ts";

export type { FigureProps } from "#src/figures/element.ts";

// This catalog is used only while rendering HTML. The browser runtime keeps
// its lazy imports, so each page downloads only the kinds it actually uses.
const kinds = import.meta.glob<{ default: DefinedFigure }>("../figures/kinds/*.ts", {
    eager: true,
});

export default function Figure(input: FigureProps) {
    const figure = kinds[`../figures/kinds/${input.kind}.ts`]?.default;
    if (!figure) {
        const known = Object.keys(kinds)
            .map((path) => path.replace(/^.*\/|\.ts$/g, ""))
            .join(", ");
        throw new Error(`<Figure kind="${input.kind}">: no such kind. Known: ${known}.`);
    }
    const model = prepareFigure(figure, input);
    const style: CSSProperties & { "--figure-height": string } = {
        "--figure-height": `${String(model.height)}px`,
    };
    return (
        <figure
            className="figure"
            data-figure={input.kind}
            data-props={model.serialized}
            data-fixed-height={model.fixedHeight ? "" : undefined}
            style={style}
        >
            <div className="figure-stage">
                <div role="img" aria-label={model.description}>
                    <canvas aria-hidden="true" />
                </div>
            </div>
            {(!figure.loop || Boolean(input.caption)) && (
                <figcaption>
                    {input.caption && <span>{input.caption}</span>}
                    {!figure.loop && (
                        <button className="figure-replay btn" type="button" hidden>
                            {t("figure.replay")}
                        </button>
                    )}
                </figcaption>
            )}
            {model.table && (
                <details className="figure-data">
                    <summary>{t("figure.data")}</summary>
                    <div className="table-scroll" role="region" aria-label={t("figure.data")}>
                        <table>
                            <caption>{model.table.unit || t("figure.data")}</caption>
                            <thead>
                                <tr>
                                    {model.table.columns.map((column, i) => (
                                        <th key={i} scope="col">
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {model.table.rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((value, j) =>
                                            j === 0 ? (
                                                <th key={j} scope="row">
                                                    {value}
                                                </th>
                                            ) : (
                                                <td key={j}>{value}</td>
                                            ),
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            )}
        </figure>
    );
}
