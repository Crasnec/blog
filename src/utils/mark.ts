/**
 * The site mark, drawn from the active theme.
 *
 * It is the design language at 32 pixels: paper, a line of ink, and the marker
 * struck across it. Nothing here is hand-picked — the three colours are the
 * theme's own sRGB mirror, so every theme gets a favicon that matches it
 * without anyone remembering to redraw one.
 *
 * The dark values are used in both browser themes on purpose. A tab icon sits
 * on chrome this page does not control and has to read against either, so the
 * mark is a dark tile in all cases — the site with the lights off — rather than
 * a light one that vanishes on a dark toolbar.
 */
import sharp from "sharp";
import { dark } from "./palette";

function svg(size?: number): string {
	const box =
		size === undefined
			? ""
			: ` width="${String(size)}" height="${String(size)}"`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${box}>
	<rect width="32" height="32" rx="6" fill="${dark.bg}" />
	<rect x="7" y="9" width="13" height="3" rx="1.5" fill="${dark.inkMuted}" />
	<rect x="7" y="17" width="18" height="7" rx="1.5" fill="${dark.accent}" />
</svg>
`;
}

/** The scalable mark, for `rel="icon"`. */
export const markSvg = (): string => svg();

/** Rasterised at a fixed size — the SVG carries one so sharp does not guess. */
export const markPng = (size: number): Promise<Buffer> =>
	sharp(Buffer.from(svg(size))).png().toBuffer();

/**
 * The same mark as a real `.ico`.
 *
 * Browsers still ask for `/favicon.ico` by name whether or not a page links
 * one, and Safari reaches for it before the SVG. An ICO is a six-byte header, a
 * sixteen-byte directory entry and then the image — and a PNG payload is legal
 * inside one, so there is no second encoder to carry.
 */
export async function markIco(size = 32): Promise<Buffer> {
	const png = await markPng(size);
	const header = Buffer.alloc(22);

	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(1, 4); // one image
	header.writeUInt8(size, 6); // width  (0 would mean 256)
	header.writeUInt8(size, 7); // height
	header.writeUInt8(0, 8); // palette size: not a palette image
	header.writeUInt8(0, 9); // reserved
	header.writeUInt16LE(1, 10); // colour planes
	header.writeUInt16LE(32, 12); // bits per pixel
	header.writeUInt32LE(png.length, 14);
	header.writeUInt32LE(header.length, 18); // the image starts after this

	return Buffer.concat([header, png]);
}
