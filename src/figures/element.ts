/** Shared server-side props and validation for Astro and TSX figures. */
import type { DefinedFigure } from "./kit.ts";
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

export function prepareFigure(figure: DefinedFigure, { kind, props = {}, caption, label, height }: FigureProps) {
	try {
		if (height !== undefined && (!Number.isFinite(height) || height <= 0)) throw new Error("height must be a positive finite number");
		figure.bind(props);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`<Figure kind="${kind}">: ${reason}`, { cause: error });
	}
	return {
		description: label ?? caption ?? "",
		serialized: JSON.stringify(props),
		height: height ?? figure.height,
		fixedHeight: height !== undefined,
	};
}
