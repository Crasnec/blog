/**
 * The tab icon, drawn from the active theme rather than kept in `public/`.
 *
 * A file in `public/` is copied through untouched, which is fine for anything
 * that has no opinion about the palette — and wrong for this, which is three of
 * the theme's colours and would quietly keep the old ones after a theme swap.
 */
import type { APIRoute } from "astro";
import { markSvg } from "../utils/mark";

export const GET: APIRoute = () =>
	new Response(markSvg(), {
		headers: { "Content-Type": "image/svg+xml" },
	});
