/**
 * `robots.txt`, generated rather than kept in `public/` so the sitemap line
 * follows `siteConfig.url` instead of being a second place to write the domain
 * down — and to go stale in.
 */
import type { APIRoute } from "astro";
import { siteConfig } from "../config";
import { sitePath } from "../utils/url";

export const GET: APIRoute = ({ site }) => {
	const base = site ?? new URL(siteConfig.url);

	const body = [
		"User-agent: *",
		"Allow: /",
		"",
		`Sitemap: ${new URL(sitePath("/sitemap-index.xml"), base).href}`,
		"",
	].join("\n");

	return new Response(body, { headers: { "Content-Type": "text/plain" } });
};
