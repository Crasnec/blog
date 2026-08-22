/**
 * Social cards.
 *
 * A link to a post is shared far more often than it is typed, and until now
 * every one of those shares came out as a bare text row. The card is drawn from
 * the same parts the site itself is made of — paper, ink and the marker — so a
 * shared link looks like where it came from before anyone reads the title.
 *
 * Everything happens at build time. Satori lays the card out and turns the text
 * into paths, which is what lets a Hangul title survive: the rasteriser never
 * sees a font, only outlines. Sharp then writes the PNG, because no platform
 * that unfurls a link renders SVG.
 *
 * Colours come from the active theme's sRGB mirror, so a card follows `THEME`
 * like everything else. It is always drawn light: a card is served to an
 * unfurler, not to a reader, and there is no theme to follow on the other side.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import type { SatoriOptions } from "satori";
import sharp from "sharp";
import { siteConfig } from "../config";
import { light } from "./palette";
import type { PostRef } from "./content";
import { sitePath } from "./url";

export const CARD = { width: 1200, height: 630 } as const;

const PAD = 80;

/** Where a post's card is written, and what `og:image` points at. */
export const cardPath = (ref: PostRef): string => sitePath(`/og/${ref.slug}.png`);

/** The card for everything that is not a post: index, archive, tags, about. */
export const siteCardPath = (): string => sitePath("/og/site.png");

/*
 * Only the faces the card actually sets: 600 for a title and for the nameplate,
 * 400 for running text, 500 for the mono apparatus line. Satori picks a face
 * per character rather than per run, so a Latin word inside a Hangul title
 * comes out of Plex Sans and the Hangul out of Plex Sans KR, which is the
 * pairing the site is built on.
 */
const SANS = "ibm-plex-sans/files/ibm-plex-sans-latin";
const KR = "ibm-plex-sans-kr/files/ibm-plex-sans-kr-korean";
const MONO = "ibm-plex-mono/files/ibm-plex-mono-latin";

const FACES = [
	["Plex", 400, `${SANS}-400-normal.woff`],
	["Plex", 600, `${SANS}-600-normal.woff`],
	["PlexKR", 400, `${KR}-400-normal.woff`],
	["PlexKR", 600, `${KR}-600-normal.woff`],
	["PlexMono", 500, `${MONO}-500-normal.woff`],
	["PlexMono", 600, `${MONO}-600-normal.woff`],
] as const;

let faces: SatoriOptions["fonts"] | undefined;

/*
 * Read once per build, and only when a card is actually drawn — the Korean
 * face alone is close to a megabyte, and `npm run dev` should not pay for it
 * before anything asks. `createRequire` resolves through Node's own algorithm
 * rather than from the working directory, so it still finds the files from
 * wherever Astro happens to have put this module.
 */
function fonts(): SatoriOptions["fonts"] {
	if (faces) return faces;

	const resolve = createRequire(import.meta.url).resolve;

	faces = FACES.map(([name, weight, file]) => ({
		name,
		weight,
		style: "normal" as const,
		data: readFileSync(resolve(`@fontsource/${file}`)),
	}));

	return faces;
}

type StyleValue = boolean | number | string | readonly string[] | Style;
interface Style {
	[key: string]: StyleValue;
}
type Child = Node | boolean | null | number | string | undefined | Child[];
interface Node {
	type: "div";
	props: { style: Style; children?: Child };
}

const box = (style: Style, children?: Child): Node => ({
	type: "div",
	props: { style: { display: "flex", ...style }, children },
});

/*
 * Hangul and CJK are full-width, so counting characters would size a Korean
 * title as if it were half as long as it prints. Two columns for those, one for
 * everything else — rough, but the only thing it decides is which of four sizes
 * a title is set at.
 */
const WIDE = /[\u1100-\u11ff\u2e80-\u9fff\u3000-\u303f\uac00-\ud7af\uff00-\uffef]/;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const columns = (text: string): number =>
	[...GRAPHEMES.segment(text)].reduce(
		(n, { segment }) => n + (WIDE.test(segment) ? 2 : 1),
		0,
	);

/** Four steps, so a long title shrinks rather than being cut off. */
function titleSize(text: string): number {
	const n = columns(text);
	if (n <= 34) return 72;
	if (n <= 56) return 60;
	if (n <= 84) return 50;
	return 42;
}

export interface CardInput {
	/** Set large. A post's title, or the site's name on the site card. */
	headline: string;
	/** Running text under it. The site's one-liner; a post has none. */
	sub?: string;
	/**
	 * The headline is the site's own name, so the marker is struck across it the
	 * way the masthead does it on arrival — and the wordmark above is dropped,
	 * because the card would otherwise say the same word twice.
	 */
	nameplate?: boolean;
	/** The apparatus line under it — date, reading time, tags. */
	meta?: string[];
	/** A word in the marker, for the one state a card has to state: locked. */
	badge?: string;
}

/** A post's title, at whichever of the four sizes it fits. */
const title = (text: string): Node =>
	box(
		{
			fontSize: titleSize(text),
			fontWeight: 600,
			lineHeight: 1.22,
			color: light.ink,
		},
		text,
	);

/*
 * The nameplate: the site's name in the code face, with the marker struck
 * across its lower third. The band is a box behind the text rather than a
 * background on it, because that is the shape a highlighter leaves — and
 * because it is the same geometry `.masthead-mark::before` uses on the page.
 */
const nameplateMark = (text: string): Node =>
	box({ position: "relative", alignItems: "flex-start", padding: "0 10px" }, [
		box({
			position: "absolute",
			left: 0,
			right: 0,
			bottom: 14,
			height: 28,
			background: light.accentSoft,
		}),
		box(
			{
				fontFamily: "PlexMono",
				fontSize: 78,
				fontWeight: 600,
				letterSpacing: -3.5,
				lineHeight: 1.2,
				color: light.ink,
			},
			text,
		),
	]);

function card({
	headline,
	sub,
	nameplate,
	meta,
	badge,
}: CardInput): Node {
	const apparatus: Node[] = [];

	if (badge) {
		apparatus.push(
			box(
				{
					fontFamily: "PlexMono",
					fontSize: 22,
					fontWeight: 500,
					letterSpacing: 1,
					color: light.bg,
					background: light.accent,
					padding: "5px 12px",
					borderRadius: 3,
					marginRight: 16,
				},
				badge,
			),
		);
	}

	if (meta?.length) {
		apparatus.push(
			box(
				{
					fontFamily: "PlexMono",
					fontSize: 25,
					fontWeight: 500,
					color: light.inkMuted,
					alignItems: "center",
				},
				meta.join("  ·  "),
			),
		);
	}

	return box(
		{
			width: CARD.width,
			height: CARD.height,
			flexDirection: "column",
			padding: PAD,
			background: light.bg,
			fontFamily: "Plex, PlexKR",
		},
		[
			// The site's name, in the code face the wordmark is set in on the page.
			box(
				{ alignItems: "flex-start" },
				nameplate
					? []
					: [
							box(
								{
									fontFamily: "PlexMono",
									fontSize: 24,
									fontWeight: 500,
									letterSpacing: 3,
									textTransform: "uppercase",
									color: light.ink,
									background: light.accentSoft,
									padding: "6px 12px",
								},
								siteConfig.title,
							),
						],
			),

			// Everything else is pinned to the bottom edge, so a two-line title and
			// a five-line one start from the same place rather than drifting.
			box({ flexGrow: 1 }),

			box({ alignItems: "flex-start" }, [
				nameplate ? nameplateMark(headline) : title(headline),
			]),

			...(sub
				? [
						box(
							{
								marginTop: 26,
								fontSize: 34,
								lineHeight: 1.4,
								color: light.inkMuted,
							},
							sub,
						),
					]
				: []),

			...(apparatus.length
				? [box({ marginTop: 28, alignItems: "center" }, apparatus)]
				: []),
		],
	);
}

/** One card, as a PNG. */
export async function renderCard(input: CardInput): Promise<Buffer> {
	const svg = await satori(card(input), {
		width: CARD.width,
		height: CARD.height,
		fonts: fonts(),
		embedFont: true,
	});

	return sharp(Buffer.from(svg)).png().toBuffer();
}
