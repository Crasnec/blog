/**
 * `/favicon.ico`, for the browsers that ask for it by name whether or not the
 * page links one — and so that the request does not land on a 404.
 */
import type { APIRoute } from "astro";
import { markIco } from "../utils/mark";

export const GET: APIRoute = async () =>
	new Response(new Uint8Array(await markIco()), {
		headers: { "Content-Type": "image/x-icon" },
	});
