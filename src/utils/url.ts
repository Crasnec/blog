/**
 * Prefixes a site-absolute path with Astro's configured deployment base.
 *
 * Local links in the source are written from `/`. Astro may expose `BASE_URL`
 * with or without a trailing slash depending on deployment and its
 * trailing-slash setting, so this is the one place that normalises and joins
 * the two.
 */
export function sitePath(path = "/"): string {
	const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
	const relative = path.replace(/^\/+/, "");
	return relative ? `${base}/${relative}` : `${base}/`;
}
