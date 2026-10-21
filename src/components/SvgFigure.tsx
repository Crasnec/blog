/** A shared accessible frame for a bespoke TSX/SVG illustration. */
import type { ReactNode } from "react";

export default function SvgFigure({ name, label, caption, width, height, children, maxWidth = "100%" }: { name: string; label: string; caption?: string; width: number; height: number; children: ReactNode; maxWidth?: number | string }) {
	if (![width, height].every((n) => Number.isFinite(n) && n > 0)) throw new Error("SvgFigure width and height must be positive finite numbers");
	return (
		<figure className="figure" data-static-figure={name}>
			<svg viewBox={`0 0 ${String(width)} ${String(height)}`} role="img" aria-label={label} style={{ display: "block", width: "100%", height: "auto", maxWidth, marginInline: "auto", fontFamily: "var(--font-sans)" }}>
				{children}
			</svg>
			{caption && <figcaption><span>{caption}</span></figcaption>}
		</figure>
	);
}
