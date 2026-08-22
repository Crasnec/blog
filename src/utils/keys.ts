/**
 * The repository's keypair, read at build time.
 *
 * Read rather than imported, because a repository with no locked post in it
 * should not need a keypair at all — a static import would be resolved whether
 * or not anything rendered it, and a missing file would fail the build with a
 * message about a module rather than about a key.
 *
 * Both halves are committed and both are safe to publish; see
 * `src/utils/secret.ts` for why the private one is.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
	parsePrivateKeyFile,
	parsePublicKeyFile,
	type PrivateKeyFile,
	type PublicKeyFile,
} from "./secret";
import { parseJson, type JsonValue } from "./json";

/*
 * From the working directory, not from this module: by the time it runs it has
 * been bundled into `dist/.prerender/`, and a path relative to itself would
 * point inside the build output. Astro builds from the project root.
 */
const at = (name: string) => resolve(process.cwd(), "keys", name);

function read<T>(name: string, decode: (value: JsonValue) => T | null): T {
	let source: string;
	try {
		source = readFileSync(at(name), "utf8");
	} catch (cause) {
		throw new Error(
			`[secret] keys/${name} could not be read. A locked post needs the ` +
				"repository's keypair; run `npm run secret:keygen` once and commit " +
				"both halves. If you have no locked posts, remove the `sealed` " +
				"frontmatter instead.",
			{ cause },
		);
	}

	let value: JsonValue;
	try {
		value = parseJson(source);
	} catch (cause) {
		throw new Error(`[secret] keys/${name} is not valid JSON.`, { cause });
	}

	const decoded = decode(value);
	if (!decoded) {
		throw new Error(`[secret] keys/${name} has an invalid key structure.`);
	}

	return decoded;
}

/** Seals a post. Needs no passphrase, which is the point of the whole scheme. */
export const publicKey = (): PublicKeyFile =>
	read("public.json", parsePublicKeyFile);

/** Opens one, once the reader supplies the passphrase it is wrapped in. */
export const privateKey = (): PrivateKeyFile =>
	read("private.json", parsePrivateKeyFile);
