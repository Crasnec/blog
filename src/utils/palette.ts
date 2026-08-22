/**
 * The active theme's colours in sRGB, for the things that are rendered rather
 * than styled.
 *
 * A social card is drawn by satori and the favicon is emitted as a standalone
 * file; neither is a stylesheet, so neither can read a custom property, and
 * `oklch()` is no use to either. `palette.css` already states the palette a
 * second time as sRGB hex — the `--hex-*` block, which exists because Mermaid
 * needs it — so this reads that block rather than adding a third place for a
 * theme to write its colours down.
 *
 * The glob is resolved by the bundler and the active theme is picked out of it
 * by name, so this follows `THEME` exactly the way the stylesheets do, and a
 * theme that is missing a mirror token fails the build instead of rendering a
 * card in whatever colour happened to be left over.
 */
import { THEME } from "../theme.config.mjs";

export interface Mirror {
	/** Raised paper — the ground a card is drawn on. */
	bg: string;
	/** Sunk paper. */
	surface: string;
	ink: string;
	inkMuted: string;
	rule: string;
	/** The marker. */
	accent: string;
	/** The marker as a wash, chosen rather than mixed. */
	accentSoft: string;
}

const TOKENS: Record<keyof Mirror, string> = {
	bg: "--hex-bg",
	surface: "--hex-surface",
	ink: "--hex-ink",
	inkMuted: "--hex-ink-muted",
	rule: "--hex-rule",
	accent: "--hex-accent",
	accentSoft: "--hex-accent-soft",
};

const sources = import.meta.glob("../styles/themes/*/palette.css", {
	query: "?raw",
	import: "default",
	eager: true,
});

const source = sources[`../styles/themes/${THEME}/palette.css`];

if (source === undefined) {
	throw new Error(
		`theme "${THEME}": src/styles/themes/${THEME}/palette.css does not exist.`,
	);
}

/*
 * `:root` up to `:root.dark` is the light block and the rest is the dark one.
 * A token name is matched up to its colon, so `--hex-ink` cannot swallow
 * `--hex-ink-muted`.
 */
function read(block: string, where: string): Mirror {
	const out: Partial<Mirror> = {};

	for (const [key, token] of Object.entries(TOKENS)) {
		const found = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(block);

		if (!found?.[1]) {
			throw new Error(
				`theme "${THEME}": ${token} is missing from ${where} in palette.css. ` +
					"The sRGB mirror is what diagrams, the social cards and the favicon " +
					"are drawn from — see src/styles/themes/README.md.",
			);
		}

		out[key as keyof Mirror] = found[1];
	}

	return out as Mirror;
}

const cut = source.indexOf(":root.dark");

if (cut === -1) {
	throw new Error(`theme "${THEME}": palette.css has no ":root.dark" block.`);
}

export const light = read(source.slice(0, cut), ":root");
export const dark = read(source.slice(cut), ":root.dark");
