/**
 * The home-screen icon. iOS ignores an SVG favicon and looks for this path by
 * name, so it is generated from the same mark at the size Apple asks for.
 */
import type { APIRoute } from "astro";
import { markPng } from "../utils/mark";

export const GET: APIRoute = async () =>
	new Response(new Uint8Array(await markPng(180)), {
		headers: { "Content-Type": "image/png" },
	});
