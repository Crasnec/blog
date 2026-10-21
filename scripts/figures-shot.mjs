/**
 * Stills of every animated figure on a page, so whoever wrote one can look at
 * it instead of guessing.
 *
 *   npm run figures:shot -- /posts/build/animated-figures/
 *
 * For each figure on the page it writes
 * `.figures-shots/<n>-<kind>-<theme>-<at>.png` at four moments of the
 * animation, in light and dark, and prints the paths. A figure that threw while
 * drawing, or a page that failed to render, is reported with the error.
 *
 * No dev server needs to be started first. The script uses, in order:
 *   1. `FIGURES_BASE`, if set (e.g. `http://localhost:4400`);
 *   2. this project's own running dev server, found through the lock file
 *      Astro writes at `.astro/dev.json`;
 *   3. a dev server of its own on a free port, which it stops when done.
 * It is always a dev server because drafts are only served in development.
 * The third case runs Astro in the foreground as a child of this script, so
 * it also works in sandboxes where `astro dev --background` exits early, and
 * with `--ignore-lock`, so a stale lock file cannot stop it. Sandboxes such as
 * Codex's kill background servers when a command ends but leave their lock
 * file behind, and give each command a fresh PID namespace, so Astro may think
 * a long-dead server is still running.
 *
 * `FIGURES_AT=0.5,0.55` picks other moments (fractions of the duration),
 * `FIGURES_WIDTH=390` checks a phone-width column, and `FIGURES_OUT=dir`
 * writes somewhere other than `.figures-shots/` (it is emptied first).
 *
 * The moments come from `?figure-at=`, which the runtime reads to freeze every
 * figure at that fraction of its duration — see `src/scripts/figures.ts`.
 */

/* global document -- the page.evaluate callbacks run in the browser. */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const path = process.argv[2] ?? "/";
const out = process.env.FIGURES_OUT ?? ".figures-shots";
const lockFile = ".astro/dev.json";
const moments = (process.env.FIGURES_AT ?? "0.15,0.4,0.7,1")
	.split(",")
	.map(Number);
/** @type {("light" | "dark")[]} */
const themes = ["light", "dark"];

/**
 * The form of `url` that a server answers on, or undefined. Astro's dev server
 * may listen on IPv6 only, while Node resolves `localhost` to 127.0.0.1, so
 * each loopback spelling is tried in turn.
 * @param {string} url
 */
async function reachable(url) {
	const spellings = /\/\/localhost\b/.test(url)
		? [url, url.replace("localhost", "[::1]"), url.replace("localhost", "127.0.0.1")]
		: [url];
	for (const candidate of spellings) {
		try {
			await fetch(candidate, { signal: AbortSignal.timeout(3000) });
			return candidate;
		} catch {
			// Try the next spelling.
		}
	}
	return undefined;
}

/** @returns {Promise<number>} */
function freePort() {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once("error", reject);
		probe.listen(0, () => {
			const address = probe.address();
			probe.close(() => {
				resolve(typeof address === "object" && address ? address.port : 4400);
			});
		});
	});
}

/**
 * Where to load pages from, and how to clean up afterwards.
 * @returns {Promise<{ base: string, stop: () => Promise<void> }>}
 */
async function devServer() {
	const nothing = async () => {};
	if (process.env.FIGURES_BASE) return { base: process.env.FIGURES_BASE, stop: nothing };

	let stale = "";
	try {
		/** @type {{ url?: string }} */
		const lock = JSON.parse(await readFile(lockFile, "utf8"));
		const base = lock.url ? await reachable(lock.url) : undefined;
		if (base) return { base, stop: nothing };
		stale = lock.url ?? "";
	} catch {
		// No lock file: start our own below.
	}

	const port = await freePort();
	const base = `http://localhost:${String(port)}`;
	console.error(
		stale
			? `${lockFile} names ${stale}, which does not answer, so that server is gone ` +
					`(\`astro dev status\` may still list it). Starting a private one at ${base}.`
			: `No dev server for this project is running; starting a private one at ${base}.`,
	);
	const child = spawn(
		process.execPath,
		// `--ignore-lock` neither checks nor writes `.astro/dev.json`: this
		// server is private to the script and must not be blocked by, or leave
		// behind, a lock file.
		["node_modules/astro/bin/astro.mjs", "dev", "--port", String(port), "--ignore-lock"],
		// ASTRO_DEV_BACKGROUND keeps Astro in the foreground even when it
		// detects an agent, so the server lives exactly as long as this script.
		{ env: { ...process.env, ASTRO_DEV_BACKGROUND: "1" }, stdio: ["ignore", "ignore", "pipe"] },
	);
	let log = "";
	child.stderr.on("data", (chunk) => (log += String(chunk)));

	const stop = async () => {
		child.kill("SIGTERM");
		await sleep(500);
	};

	for (let waited = 0; waited < 90; waited++) {
		if (child.exitCode !== null) throw new Error(`The dev server exited:\n${log}`);
		const ready = await reachable(base);
		if (ready) return { base: ready, stop };
		await sleep(1000);
	}
	await stop();
	throw new Error(`The dev server did not answer at ${base} within 90s:\n${log}`);
}

/**
 * The build error the dev server is showing, if any. A post that throws while
 * rendering, such as a `<Figure>` with bad props, still answers 200, and the
 * message is inside Vite's error overlay rather than the page text.
 * @param {import("playwright").Page} page
 */
async function buildError(page) {
	return page
		.evaluate(() => {
			const overlay = document.querySelector("vite-error-overlay")?.shadowRoot;
			return overlay?.querySelector("#message-content")?.textContent?.trim() ?? "";
		})
		.catch(() => "");
}

/**
 * Why a page has nothing to shoot, in words someone can act on.
 * @param {import("playwright").Page} page
 */
async function whatWentWrong(page) {
	const error = await buildError(page);
	if (error) return error;
	const body = await page.evaluate(() => document.body.innerText).catch(() => "");
	return body.split("\n").filter(Boolean).slice(0, 12).join("\n  ");
}

const server = await devServer();
const browser = await chromium.launch();
/** @type {string[]} */
const written = [];
let failed = false;

try {
	await rm(out, { recursive: true, force: true });
	await mkdir(out, { recursive: true });

	for (const theme of themes) {
		for (const at of moments) {
			const page = await browser.newPage({
				viewport: { width: Number(process.env.FIGURES_WIDTH ?? 900), height: 1200 },
				colorScheme: theme,
				deviceScaleFactor: 2,
			});
			/** @type {string[]} */
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			page.on("console", (message) => {
				if (message.type() === "error") errors.push(message.text());
			});

			const url = new URL(path, server.base);
			url.searchParams.set("figure-at", String(at));
			const response = await page.goto(url.href, { waitUntil: "networkidle" });
			const error = await buildError(page);
			if (error) throw new Error(`${url.pathname} failed to build:\n  ${error}`);
			if (!response?.ok()) {
				throw new Error(
					`${url.pathname} answered ${String(response?.status())}. Page says:\n  ${await whatWentWrong(page)}`,
				);
			}

			const figures = await page.$$(".figure[data-figure], .figure[data-static-figure]");
			if (figures.length === 0) {
				throw new Error(`No <Figure> on ${url.pathname}. Page says:\n  ${await whatWentWrong(page)}`);
			}
			const animatedCount = await page.locator(".figure[data-figure]").count();
			await page
				.waitForFunction(
					(n) => document.querySelectorAll(".figure[data-figure].is-ready").length === n,
					animatedCount,
					{ timeout: 10_000 },
				)
				.catch(() => undefined);
			await page.evaluate(() => document.fonts.ready);

			// The dev toolbar and back-to-top button float over the page.
			await page.evaluate(() => {
				for (const el of document.querySelectorAll("astro-dev-toolbar, #back-to-top")) el.remove();
			});

			for (const [i, figure] of figures.entries()) {
				const kind = await figure.getAttribute("data-figure") ?? await figure.getAttribute("data-static-figure");
				await figure.scrollIntoViewIfNeeded();
				const file = `${out}/${String(i + 1)}-${kind}-${theme}-${String(at)}.png`;
				await figure.screenshot({ path: file });
				written.push(file);
			}

			if (errors.length > 0) {
				failed = true;
				console.error(`Errors at ${theme} ${String(at)}:\n  ${errors.join("\n  ")}`);
			}
			await page.close();
		}
	}
	console.log(written.join("\n"));
} catch (error) {
	failed = true;
	console.error(error instanceof Error ? error.message : String(error));
} finally {
	await browser.close();
	await server.stop();
}

if (failed) process.exitCode = 1;
