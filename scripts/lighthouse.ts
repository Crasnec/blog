import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import {
    createServer,
    Server as HttpServer,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";
import { createServer as createPortServer, type Server } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import lighthouse, { desktopConfig, type Result } from "lighthouse";
import { chromium, type Browser } from "playwright";

type Device = "mobile" | "desktop";
const categories = ["performance", "accessibility", "best-practices", "seo"] as const;
type Category = (typeof categories)[number];
const metricIds = [
    "first-contentful-paint",
    "largest-contentful-paint",
    "speed-index",
    "total-blocking-time",
    "cumulative-layout-shift",
    "interactive",
] as const;
const compress = promisify(gzip);
const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".map": "application/json",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".wasm": "application/wasm",
    ".pdf": "application/pdf",
};

async function listen(server: Server): Promise<number> {
    await new Promise<void>((done, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.removeListener("error", reject);
            done();
        });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No TCP port was assigned");
    return address.port;
}

async function close(server: Server): Promise<void> {
    if (!server.listening) return;
    await new Promise<void>((done, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else done();
        });
        if (server instanceof HttpServer) server.closeAllConnections();
    });
}

async function debugPort(): Promise<number> {
    const reservation = createPortServer();
    try {
        return await listen(reservation);
    } finally {
        await close(reservation);
    }
}

async function staticSite(directory: string) {
    const root = await realpath(directory);
    const inside = (path: string) => path === root || path.startsWith(`${root}${sep}`);
    const files = new Map<string, Promise<{ body: Buffer; gzip: Buffer | null; type: string }>>();
    async function respond(request: IncomingMessage, response: ServerResponse) {
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
        }
        try {
            const url = new URL(request.url ?? "/", "http://127.0.0.1");
            const pathname = decodeURIComponent(url.pathname);
            let file = resolve(root, `.${pathname}`);
            if (!inside(file)) {
                response.writeHead(403).end("Forbidden");
                return;
            }
            file = await realpath(file);
            if (!inside(file)) {
                response.writeHead(403).end("Forbidden");
                return;
            }
            if ((await stat(file)).isDirectory()) {
                if (!url.pathname.endsWith("/")) {
                    response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
                    return;
                }
                file = await realpath(join(file, "index.html"));
            }
            if (!inside(file)) {
                response.writeHead(403).end("Forbidden");
                return;
            }
            let pending = files.get(file);
            if (!pending) {
                const type = mimeTypes[extname(file).toLowerCase()] ?? "application/octet-stream";
                pending = readFile(file).then(async (body) => ({
                    body,
                    type,
                    gzip: /^(?:text\/|application\/(?:json|xml|manifest\+json)|image\/svg\+xml)/u.test(
                        type,
                    )
                        ? await compress(body)
                        : null,
                }));
                files.set(file, pending);
            }
            const resource = await pending;
            const acceptsGzip = (request.headers["accept-encoding"] ?? "")
                .split(",")
                .some((entry) => {
                    const [encoding, ...parameters] = entry.trim().split(";");
                    return (
                        encoding === "gzip" &&
                        !parameters.some((parameter) => /^\s*q=0(?:\.0*)?\s*$/u.test(parameter))
                    );
                });
            const encoded = acceptsGzip ? resource.gzip : null;
            const body = encoded ?? resource.body;
            response.writeHead(200, {
                "Content-Type": resource.type,
                "Content-Length": body.byteLength,
                "Cache-Control": "public, max-age=600",
                ...(resource.gzip ? { Vary: "Accept-Encoding" } : {}),
                ...(encoded ? { "Content-Encoding": "gzip" } : {}),
            });
            response.end(request.method === "HEAD" ? undefined : body);
        } catch (error) {
            response
                .writeHead(error instanceof URIError ? 400 : 404, {
                    "Content-Type": "text/plain; charset=utf-8",
                })
                .end(error instanceof URIError ? "Bad request" : "Not found");
        }
    }
    const server = createServer((request, response) => {
        void respond(request, response).catch(() => {
            response.destroy();
        });
    });
    try {
        const port = await listen(server);
        return { server, origin: `http://127.0.0.1:${String(port)}`, root };
    } catch (error) {
        await close(server);
        throw error;
    }
}

function selections() {
    const paths = [
        ...new Set(
            (process.env.LIGHTHOUSE_PATHS ?? "/")
                .split(",")
                .map((path) => path.trim())
                .filter(Boolean),
        ),
    ];
    if (
        !paths.length ||
        paths.some(
            (path) =>
                !path.startsWith("/") ||
                path.startsWith("//") ||
                new URL(path, "http://127.0.0.1").origin !== "http://127.0.0.1",
        )
    )
        throw new Error(
            "LIGHTHOUSE_PATHS must contain comma-separated local paths beginning with /",
        );
    const devices: Device[] = [];
    for (const device of (process.env.LIGHTHOUSE_DEVICES ?? "mobile,desktop").split(",")) {
        const value = device.trim();
        if (value !== "mobile" && value !== "desktop")
            throw new Error("LIGHTHOUSE_DEVICES accepts mobile and desktop");
        if (!devices.includes(value)) devices.push(value);
    }
    return { paths, devices };
}

function summarize(result: Result) {
    const scores: Record<Category, number | null> = {
        performance: result.categories.performance?.score ?? null,
        accessibility: result.categories.accessibility?.score ?? null,
        "best-practices": result.categories["best-practices"]?.score ?? null,
        seo: result.categories.seo?.score ?? null,
    };
    return {
        passed: !result.runtimeError && categories.every((category) => scores[category] === 1),
        lighthouseVersion: result.lighthouseVersion,
        userAgent: result.userAgent,
        environment: result.environment,
        settings: result.configSettings,
        scores,
        metrics: Object.fromEntries(
            metricIds.map((id) => {
                const metric = result.audits[id];
                return [
                    id,
                    {
                        value: metric?.numericValue ?? null,
                        unit: metric?.numericUnit ?? null,
                        display: metric?.displayValue ?? null,
                    },
                ];
            }),
        ),
        failures: Object.values(result.audits)
            .filter((audit) => (audit.score !== null && audit.score < 1) || audit.errorMessage)
            .map((audit) => ({
                id: audit.id,
                title: audit.title,
                score: audit.score,
                display: audit.displayValue ?? null,
                explanation: audit.explanation ?? null,
                error: audit.errorMessage ?? null,
            })),
        warnings: result.runWarnings,
        runtimeError: result.runtimeError ?? null,
    };
}

interface AuditRun extends ReturnType<typeof summarize> {
    path: string;
    device: Device;
    reports: { html: string; json: string };
}

async function main() {
    const { paths, devices } = selections();
    const directory = resolve(process.env.LIGHTHOUSE_DIST ?? "dist");
    const output = resolve(process.env.LIGHTHOUSE_OUTPUT ?? ".cache/lighthouse");
    const startedAt = new Date().toISOString();
    const runs: AuditRun[] = [];
    const errors: { path: string; device: Device; error: string }[] = [];
    let browser: Browser | undefined;
    let server: Server | undefined;
    let browserVersion: string | null = null;
    const cancellation = new AbortController();
    let fatalError: string | null = null;
    let cleanupTask = Promise.resolve();
    function cleanup(): Promise<void> {
        cleanupTask = cleanupTask.then(async () => {
            const activeBrowser = browser;
            const activeServer = server;
            browser = undefined;
            server = undefined;
            const results = await Promise.allSettled([
                activeBrowser?.close(),
                activeServer ? close(activeServer) : Promise.resolve(),
            ]);
            for (const result of results) {
                if (result.status !== "rejected") continue;
                console.error(`Cleanup failed: ${String(result.reason)}`);
                process.exitCode = 1;
            }
        });
        return cleanupTask;
    }
    const interrupt = (code: number) => {
        cancellation.abort();
        process.exitCode = code;
        void cleanup();
    };
    const onInterrupt = () => {
        interrupt(130);
    };
    const onTerminate = () => {
        interrupt(143);
    };
    const checkInterrupt = () => {
        if (cancellation.signal.aborted) throw new Error("Lighthouse audit interrupted");
    };
    await mkdir(output, { recursive: true });
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
    try {
        const site = await staticSite(directory);
        server = site.server;
        checkInterrupt();
        const port = await debugPort();
        checkInterrupt();
        browser = await chromium.launch({
            headless: true,
            args: [
                `--remote-debugging-port=${String(port)}`,
                "--remote-debugging-address=127.0.0.1",
            ],
        });
        browserVersion = browser.version();
        checkInterrupt();
        for (const path of paths) {
            for (const device of devices) {
                checkInterrupt();
                console.log(`Lighthouse ${device}: ${path}`);
                try {
                    const result = await lighthouse(
                        new URL(path, site.origin).href,
                        {
                            port,
                            hostname: "127.0.0.1",
                            logLevel: "error",
                            output: ["html", "json"],
                            onlyCategories: [...categories],
                        },
                        device === "desktop" ? desktopConfig : undefined,
                    );
                    if (!result || !Array.isArray(result.report))
                        throw new Error("Lighthouse did not produce HTML and JSON reports");
                    const [html, json] = result.report;
                    if (!html || !json) throw new Error("Lighthouse returned an incomplete report");
                    const slug =
                        path === "/"
                            ? "home"
                            : `${path
                                .replace(/[^a-z0-9_-]+/giu, "-")
                                .slice(
                                    0,
                                    80,
                                )}-${createHash("sha256").update(path).digest("hex").slice(0, 8)}`;
                    const name = `${device}-${slug}`;
                    const reports = { html: `${name}.html`, json: `${name}.json` };
                    await writeFile(join(output, reports.html), html);
                    await writeFile(join(output, reports.json), json);
                    const run = { path, device, reports, ...summarize(result.lhr) };
                    runs.push(run);
                    console.log(JSON.stringify({ path, device, scores: run.scores }));
                    if (!run.passed) process.exitCode = 1;
                } catch (error) {
                    errors.push({ path, device, error: String(error) });
                    console.error(`${device} ${path}: ${String(error)}`);
                    if (!cancellation.signal.aborted) process.exitCode = 1;
                }
            }
        }
    } catch (error) {
        fatalError = String(error);
        throw error;
    } finally {
        await cleanup();
        process.removeListener("SIGINT", onInterrupt);
        process.removeListener("SIGTERM", onTerminate);
        await writeFile(
            join(output, "summary.json"),
            JSON.stringify(
                {
                    startedAt,
                    finishedAt: new Date().toISOString(),
                    directory,
                    browserVersion,
                    nodeVersion: process.version,
                    server: { compression: "gzip for text", cacheControl: "public, max-age=600" },
                    paths,
                    devices,
                    interrupted: cancellation.signal.aborted,
                    fatalError,
                    passed:
                        !cancellation.signal.aborted &&
                        fatalError === null &&
                        errors.length === 0 &&
                        runs.length === paths.length * devices.length &&
                        runs.every((run) => run.passed),
                    runs,
                    errors,
                },
                null,
                4,
            ),
        );
        console.log(`Reports: ${output}`);
    }
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode ??= 1;
}
