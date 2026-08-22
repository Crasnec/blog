/**
 * Locked posts.
 *
 * A static site cannot keep a secret by hiding it: everything in `dist/` is
 * readable by anyone who knows the URL, so a password screen in front of HTML
 * that is already on the page is theatre. The only honest version is to publish
 * ciphertext.
 *
 * The ciphertext is made **by the author, before committing** — see
 * `scripts/secret.mjs`. The plaintext and the passphrase never enter this
 * repository, so it can be public; the build reads a sealed post exactly as a
 * stranger would, and has no more ability to open it than they do. Nothing
 * between the author's machine and the reader's browser ever holds the plain
 * body, which is a stronger claim than "the build encrypts it" and the whole
 * reason the scheme moved.
 *
 * Sealing needs no passphrase. The repository carries a keypair — the public
 * half in the clear, the private half wrapped in the same passphrase a reader
 * types — so a post can be written and sealed on any machine that has the repo,
 * and only opened by someone who knows the passphrase. That asymmetry is the
 * point: writing is something you do from wherever you happen to be, and
 * knowing the passphrase should not be a condition of it.
 *
 * ECDH over P-256 with a fresh ephemeral keypair per seal, HKDF-SHA256 to turn
 * the shared secret into a key, AES-GCM to do the work. PBKDF2-SHA256 at 600k
 * guards the private key at rest. Both sides use this module, so the parameters
 * cannot drift apart.
 *
 * Publishing the wrapped private key costs nothing that publishing the
 * ciphertext did not already cost: both are opened by the same passphrase and
 * by nothing else. What it buys is that a reader needs the passphrase and
 * nothing else either — no key to carry, no file to install.
 *
 * What this does *not* hide: that the post exists, its title, its date, its
 * tags and its category. Only the body is a secret. Title it accordingly.
 *
 * What it does *not* prove: who sealed it. Anyone with the repository has the
 * public key and can produce a post that opens correctly. Only the author can
 * push, which is where that is answered.
 */

import { isJsonObject, parseJson, type JsonValue } from "./json.ts";

/** OWASP's floor for PBKDF2-SHA256. Costs the reader about a second, once. */
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/**
 * Bumped when the scheme changes, so an old payload fails loudly instead of
 * decrypting into something the page no longer knows how to use. 3 is the
 * keypair scheme: sealing takes the public key and no passphrase.
 */
const VERSION = 3;

const CURVE = { name: "ECDH", namedCurve: "P-256" } as const;

/**
 * Binds the derivation to this scheme, so a key cannot be used across two.
 *
 * Change it and every post already sealed stops opening. If you are going to,
 * do it before you seal anything — or open them all first and seal them again.
 */
const INFO = "sealed-post/v3";

/**
 * What is inside the ciphertext.
 *
 * Both halves, and the source is not an afterthought: once a post is sealed the
 * repository holds no other copy of it, so a payload that carried only the
 * rendered HTML would be a one-way door — the author could reread the post and
 * never edit it again. `npm run secret:open` gets the Markdown back out.
 */
export interface SecretSource {
	/** The rendered body, as the build would have rendered it. */
	html: string;
	/** The Markdown it came from, so sealing is reversible. */
	md: string;
}

/** Committed in the clear. Sealing needs this and nothing else. */
export interface PublicKeyFile {
	v: number;
	alg: "ECDH-P-256";
	key: JsonWebKey;
}

/**
 * Committed too, and safe to: it is the private key wrapped in the passphrase.
 * An attacker holding this holds what they already held — something the
 * passphrase opens and nothing else does.
 */
export interface PrivateKeyFile {
	v: number;
	/** PBKDF2 iterations, carried so an old file still opens. */
	it: number;
	salt: string;
	iv: string;
	data: string;
}

export interface SecretPayload {
	v: number;
	/** The seal's own public key, in the clear. Fresh every time. */
	epk: string;
	iv: string;
	data: string;
	/**
	 * Which theme drew the code blocks, in the clear.
	 *
	 * A sealed body is rendered once and never again, so it keeps the syntax
	 * colours of the theme that was active when it was sealed. Recording the
	 * name is what lets the build notice that the site has since moved on and
	 * say so, rather than serving one post in the old palette in silence.
	 */
	theme: string;
}

const isPositiveInteger = (value: JsonValue | undefined): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export function parseSecretSource(value: JsonValue): SecretSource | null {
	if (
		!isJsonObject(value) ||
		typeof value.html !== "string" ||
		typeof value.md !== "string"
	) {
		return null;
	}
	return { html: value.html, md: value.md };
}

export function parsePrivateKeyFile(value: JsonValue): PrivateKeyFile | null {
	if (
		!isJsonObject(value) ||
		!isPositiveInteger(value.v) ||
		!isPositiveInteger(value.it) ||
		typeof value.salt !== "string" ||
		typeof value.iv !== "string" ||
		typeof value.data !== "string"
	) {
		return null;
	}
	return {
		v: value.v,
		it: value.it,
		salt: value.salt,
		iv: value.iv,
		data: value.data,
	};
}

export function parsePublicKeyFile(value: JsonValue): PublicKeyFile | null {
	if (
		!isJsonObject(value) ||
		!isPositiveInteger(value.v) ||
		value.alg !== "ECDH-P-256" ||
		!isJsonObject(value.key) ||
		value.key.kty !== "EC" ||
		value.key.crv !== "P-256" ||
		typeof value.key.x !== "string" ||
		typeof value.key.y !== "string"
	) {
		return null;
	}
	return {
		v: value.v,
		alg: value.alg,
		key: {
			kty: value.key.kty,
			crv: value.key.crv,
			x: value.key.x,
			y: value.key.y,
		},
	};
}

export function parseSecretPayload(value: JsonValue): SecretPayload | null {
	if (
		!isJsonObject(value) ||
		!isPositiveInteger(value.v) ||
		typeof value.epk !== "string" ||
		typeof value.iv !== "string" ||
		typeof value.data !== "string" ||
		typeof value.theme !== "string"
	) {
		return null;
	}
	return {
		v: value.v,
		epk: value.epk,
		iv: value.iv,
		data: value.data,
		theme: value.theme,
	};
}

const encoder = new TextEncoder();

/*
 * Chunked, because `String.fromCharCode(...bytes)` spreads one argument per
 * byte and a sealed post is tens of kilobytes — enough to overflow the call
 * stack on the exact posts most worth encrypting.
 */
function toBase64(bytes: ArrayBuffer): string {
	const view = new Uint8Array(bytes);
	let binary = "";

	for (let i = 0; i < view.length; i += 0x8000) {
		binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
	}

	return btoa(binary);
}

export const fromBase64 = (value: string): Uint8Array =>
	Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

/** The key that wraps the private key. Slow on purpose; run once per open. */
async function wrapKey(
	passphrase: string,
	salt: Uint8Array,
	iterations: number,
): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey(
		"raw",
		encoder.encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * A new keypair, and the passphrase that will open it from now on.
 *
 * Run once. Both halves are meant to be committed: the public one does the
 * sealing, the private one is wrapped in the passphrase and does the opening.
 * Losing the passphrase loses every post sealed to this key, and there is no
 * second copy anywhere by design.
 */
export async function generateKeys(passphrase: string): Promise<{
	pub: PublicKeyFile;
	priv: PrivateKeyFile;
}> {
	const pair = await crypto.subtle.generateKey(CURVE, true, ["deriveBits"]);

	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

	const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
	const sealedKey = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: iv as BufferSource },
		await wrapKey(passphrase, salt, ITERATIONS),
		pkcs8,
	);

	return {
		pub: {
			v: VERSION,
			alg: "ECDH-P-256",
			key: await crypto.subtle.exportKey("jwk", pair.publicKey),
		},
		priv: {
			v: VERSION,
			it: ITERATIONS,
			salt: toBase64(salt.buffer),
			iv: toBase64(iv.buffer),
			data: toBase64(sealedKey),
		},
	};
}

/**
 * The same key, behind a different passphrase.
 *
 * Only the wrapping changes: the keypair is untouched, so every post already
 * sealed still opens and none of them has to be rewritten. Choosing a
 * passphrase is therefore not the irreversible act it looks like — the
 * irreversible act is losing it, and this is the way out of one you have merely
 * decided against.
 *
 * Returns null if the old passphrase is wrong, which is the only failure it
 * can have.
 */
export async function rewrap(
	priv: PrivateKeyFile,
	from: string,
	to: string,
): Promise<PrivateKeyFile | null> {
	if (priv.v !== VERSION) return null;

	let pkcs8: ArrayBuffer;
	try {
		pkcs8 = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: fromBase64(priv.iv) as BufferSource },
			await wrapKey(from, fromBase64(priv.salt), priv.it),
			fromBase64(priv.data) as BufferSource,
		);
	} catch {
		return null;
	}

	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

	return {
		v: VERSION,
		it: ITERATIONS,
		salt: toBase64(salt.buffer),
		iv: toBase64(iv.buffer),
		data: toBase64(
			await crypto.subtle.encrypt(
				{ name: "AES-GCM", iv: iv as BufferSource },
				await wrapKey(to, salt, ITERATIONS),
				pkcs8,
			),
		),
	};
}

/**
 * The key one seal uses, from one side of the exchange or the other.
 *
 * The seal's own public key is the HKDF salt, so every seal derives its own key
 * even though the recipient's is fixed for the life of the repository.
 */
async function shared(
	mine: CryptoKey,
	theirs: CryptoKey,
	epk: Uint8Array,
): Promise<CryptoKey> {
	const bits = await crypto.subtle.deriveBits(
		{ name: "ECDH", public: theirs },
		mine,
		256,
	);

	const material = await crypto.subtle.importKey("raw", bits, "HKDF", false, [
		"deriveKey",
	]);

	return crypto.subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: epk as BufferSource,
			info: encoder.encode(INFO),
		},
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * Seals a post. Run on the author's machine, never by the build — and it needs
 * no passphrase, which is the whole reason for the keypair.
 *
 * It throws rather than returning anything on failure, and the sealing script
 * does not catch it: a seal that cannot be completed must stop before it writes
 * a file, because the alternative is a post committed in the clear.
 */
export async function sealTo(
	pub: PublicKeyFile,
	source: SecretSource,
	theme: string,
): Promise<SecretPayload> {
	if (pub.v !== VERSION) {
		throw new Error(
			`public key is v${String(pub.v)}, this build seals v${String(VERSION)}`,
		);
	}

	const recipient = await crypto.subtle.importKey("jwk", pub.key, CURVE, false, []);
	const once = await crypto.subtle.generateKey(CURVE, true, ["deriveBits"]);
	const epk = new Uint8Array(await crypto.subtle.exportKey("raw", once.publicKey));

	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const data = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: iv as BufferSource },
		await shared(once.privateKey, recipient, epk),
		encoder.encode(JSON.stringify(source)),
	);

	return {
		v: VERSION,
		epk: toBase64(epk.buffer),
		iv: toBase64(iv.buffer),
		data: toBase64(data),
		theme,
	};
}

/**
 * Opens a sealed post — in the reader's browser, or in the author's terminal.
 * Returns null for a wrong passphrase.
 *
 * AES-GCM authenticates, so a wrong key fails on the tag rather than producing
 * plausible rubbish — there is no way to tell the reader "nearly".
 */
export async function openWith(
	priv: PrivateKeyFile,
	passphrase: string,
	payload: SecretPayload,
): Promise<SecretSource | null> {
	if (priv.v !== VERSION || payload.v !== VERSION) return null;

	try {
		const pkcs8 = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: fromBase64(priv.iv) as BufferSource },
			await wrapKey(passphrase, fromBase64(priv.salt), priv.it),
			fromBase64(priv.data) as BufferSource,
		);

		const mine = await crypto.subtle.importKey("pkcs8", pkcs8, CURVE, false, [
			"deriveBits",
		]);

		const epk = fromBase64(payload.epk);
		const theirs = await crypto.subtle.importKey("raw", epk as BufferSource, CURVE, false, []);

		const plain = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: fromBase64(payload.iv) as BufferSource },
			await shared(mine, theirs, epk),
			fromBase64(payload.data) as BufferSource,
		);

		return parseSecretSource(parseJson(new TextDecoder().decode(plain)));
	} catch {
		return null;
	}
}
