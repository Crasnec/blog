/**
 * Mermaid diagrams.
 *
 * Mermaid is ~1 MB, so it is imported only on pages that actually contain a
 * diagram, and only once. Colours are read from the `--hex-*` tokens rather
 * than hard-coded, so a diagram matches the page in both themes — and because
 * mermaid bakes those colours into the SVG, every diagram is redrawn when the
 * theme changes.
 */

import type { Mermaid, MermaidConfig } from "mermaid";

let api: Mermaid | null = null;
let counter = 0;

function token(name: string): string {
	return getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
}

function themeConfig(): MermaidConfig {
	const ink = token("--hex-ink");
	const muted = token("--hex-ink-muted");
	const rule = token("--hex-rule");
	const accent = token("--hex-accent");
	const surface = token("--hex-surface");
	const bg = token("--hex-bg");

	return {
		startOnLoad: false,
		securityLevel: "strict",
		fontFamily: "IBM Plex Mono, IBM Plex Sans KR, monospace",
		fontSize: 13,
		theme: "base",
		themeVariables: {
			background: bg,
			primaryColor: surface,
			primaryTextColor: ink,
			primaryBorderColor: rule,
			secondaryColor: bg,
			secondaryTextColor: ink,
			secondaryBorderColor: rule,
			tertiaryColor: surface,
			tertiaryTextColor: muted,
			tertiaryBorderColor: rule,
			lineColor: muted,
			textColor: ink,
			mainBkg: surface,
			nodeBorder: rule,
			clusterBkg: bg,
			clusterBorder: rule,
			edgeLabelBackground: bg,
			labelBoxBorderColor: rule,
			// Sequence and state diagrams pick the accent up for actors/highlights.
			actorBorder: accent,
			actorBkg: surface,
			activationBorderColor: accent,
			activationBkgColor: surface,
			noteBkgColor: surface,
			noteBorderColor: rule,
			noteTextColor: muted,
		},
		flowchart: { curve: "basis", padding: 14, useMaxWidth: true },
		sequence: { useMaxWidth: true },
	};
}

async function getApi(): Promise<Mermaid> {
	api ??= (await import("mermaid")).default;
	return api;
}

export async function renderDiagrams() {
	const figures = [
		...document.querySelectorAll<HTMLElement>(".diagram[data-mermaid]"),
	];
	if (figures.length === 0) return;

	const mermaid = await getApi();
	mermaid.initialize(themeConfig());

	await Promise.all(
		figures.map(async (figure) => {
			const source = figure.dataset.mermaid;
			if (!source) return;

			// Anything from a previous render, so a theme switch starts clean.
			figure.querySelector(".diagram-svg")?.remove();
			figure.querySelector(".diagram-error")?.remove();

			try {
				counter += 1;
				const { svg } = await mermaid.render(
					`diagram-${String(counter)}`,
					source,
				);

				const holder = document.createElement("div");
				holder.className = "diagram-svg";
				holder.innerHTML = svg;

				figure.prepend(holder);
				figure.classList.remove("is-pending", "is-failed");
				figure.classList.add("is-rendered");
			} catch (error) {
				// A broken diagram falls back to its source, which is more useful
				// than an empty box — the source is what needs fixing.
				const note = document.createElement("p");
				note.className = "diagram-error";
				const message = String(
					error instanceof Error ? error.message : error,
				).split("\n")[0];
				note.textContent = message ?? "Diagram could not be rendered.";

				figure.prepend(note);
				figure.classList.remove("is-pending", "is-rendered");
				figure.classList.add("is-failed");
			}
		}),
	);
}

document.addEventListener("theme:change", () => {
	if (document.querySelector(".diagram[data-mermaid]")) void renderDiagrams();
});
