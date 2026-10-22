import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { BrowserContext } from "playwright";

const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
};

/** Route a production build from disk without starting a listening server. */
export async function serveStaticSite(
    context: BrowserContext,
    directory: string,
    origin = "https://playground.test",
): Promise<string> {
    const root = resolve(directory);
    const base = new URL(origin).origin;
    await context.route(`${base}/**`, async (route) => {
        try {
            const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
            let file = resolve(root, `.${pathname}`);
            if (file !== root && !file.startsWith(`${root}${sep}`)) {
                await route.fulfill({ status: 403, body: "Forbidden" });
                return;
            }
            if ((await stat(file)).isDirectory()) file = join(file, "index.html");
            await route.fulfill({
                status: 200,
                contentType: contentTypes[extname(file)] ?? "application/octet-stream",
                body: await readFile(file),
            });
        } catch {
            await route.fulfill({ status: 404, body: "Not found" });
        }
    });
    return base;
}
