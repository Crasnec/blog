/** Shared server-side props and validation for Astro and TSX figures. */
import type { DefinedFigure, FigureTable } from "./kit.ts";
import type { JsonObject } from "../utils/json.ts";

export interface FigureProps {
    kind: string;
    props?: JsonObject;
    /** What the reader should watch for. */
    caption?: string;
    /** Screen-reader description; defaults to caption. */
    label?: string;
    /** Override the kind's height in CSS pixels. */
    height?: number;
}

export function prepareFigure(
    figure: DefinedFigure,
    { kind, props = {}, caption, label, height }: FigureProps,
) {
    let table: FigureTable | undefined;
    try {
        if (kind === "scene" && height !== undefined) {
            throw new Error("scene computes its own responsive height; remove the height prop");
        }
        if (height !== undefined && (!Number.isFinite(height) || height <= 0)) {
            throw new Error("height must be a positive finite number");
        }
        table = figure.bind(props).table;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`<Figure kind="${kind}">: ${reason}`, { cause: error });
    }
    return {
        table,
        description: label ?? caption ?? "",
        serialized: JSON.stringify(props),
        height: height ?? figure.height,
        fixedHeight: height !== undefined,
    };
}
