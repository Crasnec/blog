/**
 * Sealing and opening a locked post.
 *
 *   npm run secret:keygen                                   once, ever
 *   npm run secret:rekey                                    change the passphrase
 *   npm run secret:seal secrets/team-retro-2026-q2.md    no passphrase
 *   npm run secret:open src/content/posts/team-retro-2026-q2.md
 *
 * The plaintext lives in `secrets/`, which is gitignored, and the sealed post
 * lives in the collection where every other post does. Sealing renders the body
 * through the same pipeline the build uses, encrypts the result together with
 * the Markdown it came from, and writes a post file that has a frontmatter and
 * no body.
 *
 * The point of doing it here rather than in the build is that afterwards there
 * is nothing left to protect: this repository can be public, and a build of it
 * — anyone's build, on any machine — has exactly the same access to the post as
 * a stranger with the URL, which is none.
 *
 * Sealing needs the repository's public key and nothing else, so a post can be
 * written and sealed on any machine that has a clone — a borrowed laptop, a
 * machine you would rather not leave a passphrase on. Only opening asks.
 *
 * The passphrase is asked for on the terminal and is never written anywhere.
 * `SECRET_PASSPHRASE` overrides the prompt for scripting; at keygen it skips
 * the confirmation, so it is on you to type it correctly.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
	createMarkdownProcessor,
	parseFrontmatter,
} from "@astrojs/markdown-remark";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import rehypeExpressiveCode from "rehype-expressive-code";
import { stringify } from "yaml";

import {
	expressiveCodeOptions,
	rehypePlugins,
	remarkPlugins,
	themeName,
} from "../src/markdown.config.mjs";
import {
	generateKeys,
	openWith,
	parsePrivateKeyFile,
	parsePublicKeyFile,
	parseSecretPayload,
	rewrap,
	sealTo,
} from "../src/utils/secret.ts";
import { parseJson } from "../src/utils/json.ts";

const ROOT = new URL("..", import.meta.url);
const PLAIN_DIR = "secrets";
const SEALED_DIR = "src/content/posts";

/*
 * Both halves are committed. The public one seals; the private one is wrapped
 * in the passphrase and opens, and is served to the reader's browser alongside
 * the ciphertext so that knowing the passphrase is the only thing a reader
 * needs. See `src/utils/secret.ts` for why that costs nothing.
 */
const KEY_DIR = "keys";
const PUBLIC_KEY = `${KEY_DIR}/public.json`;
const PRIVATE_KEY = `${KEY_DIR}/private.json`;

/** @typedef {import("../src/utils/json.ts").JsonValue | Date} FrontmatterValue */

/**
 * @template T
 * @param {string} which
 * @param {(value: import("../src/utils/json.ts").JsonValue) => T | null} decode
 * @returns {Promise<T>}
 */
async function readKey(which, decode) {
	try {
		const value = parseJson(
			await readFile(resolve(ROOT.pathname, which), "utf8"),
		);
		const decoded = decode(value);
		if (decoded) return decoded;
		fail(`${which} has an invalid key structure.`);
	} catch {
		fail(
			`no ${which}. Run \`npm run secret:keygen\` once to make a keypair, ` +
				"and commit both halves.",
		);
	}
}

/**
 * Frontmatter a sealed post may carry, all of it already visible on any
 * listing. Anything else stops the seal rather than being guessed at: a field
 * this script has not been told about might be a summary of the body, and
 * quietly copying it into a public file is the one mistake that cannot be
 * taken back.
 */
const PUBLIC_KEYS = new Set([
	"title",
	"published",
	"updated",
	"category",
	"tags",
	"draft",
]);

/** Refused by name, with a reason, because each is derived from the body. */
const LEAKY_KEYS = {
	description:
		"a description is a summary of the body — write the post so its title " +
		"and tags carry it, or accept that the summary is public and put it in " +
		"the title instead",
	secret:
		"the passphrase never belongs in a file; sealing asks for it on the " +
		"terminal and forgets it",
};

/*
 * `parseFrontmatter` gives dates back as Date objects, and YAML would write
 * them out as full timestamps. Posts are filed by day and the frontmatter is
 * read by people, so they go back the way they were written.
 */
/** @param {FrontmatterValue} value */
const asWritten = (value) =>
	value instanceof Date ? value.toISOString().slice(0, 10) : value;

/** @param {Record<string, FrontmatterValue>} frontmatter */
const publicFrontmatter = (frontmatter) =>
	Object.fromEntries(
		Object.entries(frontmatter)
			.filter(([key]) => key !== "sealed")
			.map(([key, value]) => [key, asWritten(value)]),
	);

/**
 * @param {string} message
 * @returns {never}
 */
const fail = (message) => {
	console.error(`\nsecret: ${message}\n`);
	process.exit(1);
};

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
async function askHidden(question) {
	if (!process.stdin.isTTY) {
		fail(
			"no terminal to ask for a passphrase on. Set SECRET_PASSPHRASE if you " +
				"are scripting this.",
		);
	}

	const rl = /** @type {import("node:readline").Interface & { _writeToOutput(chunk: string): void }} */ (
		createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		})
	);

	let muted = false;
	rl._writeToOutput = (chunk) => {
		if (!muted) process.stdout.write(chunk);
	};

	const answer = await new Promise((done) => {
		rl.question(question, done);
		muted = true;
	});

	process.stdout.write("\n");
	rl.close();
	return answer;
}

/** @param {"keygen" | "rekey" | "open"} action */
async function passphraseFor(action) {
	const fromEnv = process.env.SECRET_PASSPHRASE;
	if (fromEnv) return fromEnv;

	const first = await askHidden("passphrase: ");
	if (!first) fail("no passphrase given.");

	if (action === "keygen" || action === "rekey") {
		// A mistyped passphrase locks every post that will ever be sealed to
		// this key, and there is no second copy of it anywhere.
		const again = await askHidden("again: ");
		if (first !== again) fail("the two passphrases do not match.");
	}

	return first;
}

/** `secrets/x.md` ⇄ `src/content/posts/x.md`, so one path implies the other. */
/**
 * @param {string} input
 * @param {"seal" | "open"} direction
 */
function counterpart(input, direction) {
	const rel = relative(
		resolve(ROOT.pathname),
		resolve(process.cwd(), input),
	).replaceAll("\\", "/");

	const [from, to] =
		direction === "seal" ? [PLAIN_DIR, SEALED_DIR] : [SEALED_DIR, PLAIN_DIR];

	if (!rel.startsWith(`${from}/`)) {
		fail(`expected a path under ${from}/, got ${rel || input}`);
	}

	return {
		rel,
		out: `${to}/${rel.slice(from.length + 1)}`,
	};
}

/** @type {Awaited<ReturnType<typeof createMarkdownProcessor>> | undefined} */
let processor;

/**
 * The build's pipeline, plus Expressive Code — which Astro adds as an
 * integration and therefore is not in the shared plugin list.
 *
 * The copy button is switched off. A sealed body is put on the page with
 * `innerHTML` long after Expressive Code's script could have run, so the button
 * would be there and would do nothing; no button is better than a dead one.
 */
/**
 * @param {string} markdown
 * @param {URL} fileURL
 */
async function render(markdown, fileURL) {
	processor ??= await createMarkdownProcessor({
		syntaxHighlight: false,
		remarkPlugins,
		rehypePlugins: [
			...rehypePlugins,
			[
				rehypeExpressiveCode,
				{
					...expressiveCodeOptions,
					plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
					frames: { showCopyToClipboardButton: false },
				},
			],
		],
	});

	// The path is what tells `remarkBlocks` which locale to label admonitions in.
	const { code } = await processor.render(markdown, { fileURL });
	return code;
}

/** @param {string} input */
async function doSeal(input) {
	const { rel, out } = counterpart(input, "seal");
	const source = await readFile(resolve(ROOT.pathname, rel), "utf8");
	const { frontmatter, content } = parseFrontmatter(source);

	for (const [key, why] of Object.entries(LEAKY_KEYS)) {
		if (key in frontmatter) fail(`remove \`${key}\` from ${rel}: ${why}.`);
	}

	const unsupported = Object.keys(frontmatter).filter((k) => !PUBLIC_KEYS.has(k));
	if (unsupported.length > 0) {
		fail(
			`${rel} has frontmatter this script does not know is safe to publish: ` +
				`${unsupported.join(", ")}. A sealed post's frontmatter is committed in ` +
				"the clear, so add it to PUBLIC_KEYS in scripts/secret.mjs only if " +
				"you are certain it gives nothing away.",
		);
	}

	const md = content.replace(/^\n+/, "");
	if (!md.trim()) fail(`${rel} has no body to seal.`);

	const outPath = resolve(ROOT.pathname, out);
	const html = await render(md, pathToFileURL(outPath));
	const payload = await sealTo(
		await readKey(PUBLIC_KEY, parsePublicKeyFile),
		{ html, md },
		themeName,
	);

	// lineWidth 0 so YAML never folds the base64 — a wrapped line would join
	// back with a space and the payload would no longer decode.
	const head = stringify(
		{ ...publicFrontmatter(frontmatter), sealed: payload },
		{ lineWidth: 0 },
	);

	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(
		outPath,
		`---\n${head}---\n\n<!-- Sealed. The body is ciphertext in the frontmatter above; ` +
			`\`npm run secret:open ${out}\` writes the Markdown back to ${PLAIN_DIR}/. -->\n`,
		"utf8",
	);

	console.log(`\nsealed  ${rel}\n     →  ${out}  (${themeName}, ${payload.data.length} base64 chars)\n`);
}

/** @param {string} input */
async function doOpen(input) {
	const { rel, out } = counterpart(input, "open");
	const source = await readFile(resolve(ROOT.pathname, rel), "utf8");
	const { frontmatter } = parseFrontmatter(source);

	const sealed = parseSecretPayload(parseJson(JSON.stringify(frontmatter.sealed)));
	if (!sealed) fail(`${rel} is not a valid sealed post.`);

	const passphrase = await passphraseFor("open");
	const opened = await openWith(
		await readKey(PRIVATE_KEY, parsePrivateKeyFile),
		passphrase,
		sealed,
	);

	if (!opened) {
		fail(
			"could not open it. Either the passphrase is wrong, or the payload was " +
				`sealed by an older scheme (this one is v${sealed.v}).`,
		);
	}

	const outPath = resolve(ROOT.pathname, out);

	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(
		outPath,
		`---\n${stringify(publicFrontmatter(frontmatter), { lineWidth: 0 })}---\n\n${opened.md}`,
		"utf8",
	);

	console.log(`\nopened  ${rel}\n     →  ${out}  (gitignored — do not commit it)\n`);
}

/**
 * Makes the keypair. Once, ever — a new one orphans every post sealed to the
 * old one, so the existing posts have to be opened with the old passphrase and
 * sealed again before it is thrown away.
 */
async function doKeygen() {
	const existing = await readFile(
		resolve(ROOT.pathname, PUBLIC_KEY),
		"utf8",
	).catch(() => null);

	if (existing) {
		fail(
			`${PUBLIC_KEY} already exists. A second keypair cannot open anything ` +
				"sealed to the first, so open every locked post first, delete " +
				`${KEY_DIR}/, and seal them again.`,
		);
	}

	const passphrase = await passphraseFor("keygen");
	const { pub, priv } = await generateKeys(passphrase);

	await mkdir(resolve(ROOT.pathname, KEY_DIR), { recursive: true });
	await writeFile(
		resolve(ROOT.pathname, PUBLIC_KEY),
		`${JSON.stringify(pub, null, 2)}\n`,
		"utf8",
	);
	await writeFile(
		resolve(ROOT.pathname, PRIVATE_KEY),
		`${JSON.stringify(priv, null, 2)}\n`,
		"utf8",
	);

	console.log(
		`\nwrote  ${PUBLIC_KEY}   seals a post, needs no passphrase\n` +
			`       ${PRIVATE_KEY}  opens one, wrapped in the passphrase\n\n` +
			"Commit both. Neither gives anything away without the passphrase, and\n" +
			"the passphrase is now the only copy of itself that exists.\n",
	);
}

/**
 * Changes the passphrase, and nothing else.
 *
 * The keypair does not change, so nothing sealed to it has to be resealed —
 * only the wrapping around the private half is replaced.
 */
async function doRekey() {
	const priv = await readKey(PRIVATE_KEY, parsePrivateKeyFile);

	const from = process.env.SECRET_PASSPHRASE ?? (await askHidden("current passphrase: "));
	if (!from) fail("no passphrase given.");

	const to = process.env.SECRET_PASSPHRASE_NEW ?? (await askHidden("new passphrase: "));
	if (!to) fail("no new passphrase given.");
	if (!process.env.SECRET_PASSPHRASE_NEW) {
		const again = await askHidden("again: ");
		if (to !== again) fail("the two passphrases do not match.");
	}

	const rewrapped = await rewrap(priv, from, to);
	if (!rewrapped) fail("the current passphrase is wrong.");

	await writeFile(
		resolve(ROOT.pathname, PRIVATE_KEY),
		`${JSON.stringify(rewrapped, null, 2)}\n`,
		"utf8",
	);

	console.log(
		`\nrewrapped  ${PRIVATE_KEY}\n\n` +
			"The keypair is unchanged, so every sealed post still opens — with the\n" +
			"new passphrase. Commit the file. The old passphrase opens the copy in\n" +
			"your history, so treat it as still live if it ever leaked.\n",
	);
}

const [action, target] = process.argv.slice(2);

if (action === "keygen") await doKeygen();
else if (action === "rekey") await doRekey();
else if (action === "seal" && target) await doSeal(target);
else if (action === "open" && target) await doOpen(target);
else
	fail(
		"usage:\n" +
			"    npm run secret:keygen\n" +
			"    npm run secret:rekey\n" +
			`    npm run secret:seal ${PLAIN_DIR}/<slug>.md\n` +
			`    npm run secret:open ${SEALED_DIR}/<slug>.md`,
	);
