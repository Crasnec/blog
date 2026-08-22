import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseJson } from "../src/utils/json.ts";
import {
	generateKeys,
	openWith,
	parsePrivateKeyFile,
	parsePublicKeyFile,
	parseSecretPayload,
	parseSecretSource,
	sealTo,
} from "../src/utils/secret.ts";

void describe("locked post data boundaries", () => {
	void test("rejects incomplete external data", () => {
		assert.equal(parseSecretSource({ html: "<p>body</p>" }), null);
		assert.equal(parsePrivateKeyFile({ v: 3, it: -1, salt: "", iv: "", data: "" }), null);
		assert.equal(
			parsePublicKeyFile({
				v: 3,
				alg: "ECDH-P-256",
				key: { kty: "EC", crv: "P-256", x: "missing-y" },
			}),
			null,
		);
		assert.equal(parseSecretPayload({ v: 3, epk: "", iv: "", data: "" }), null);
	});

	void test("seals and opens a post only with the matching passphrase", { timeout: 15_000 }, async () => {
		const passphrase = "correct horse battery staple";
		const source = { html: "<p>private</p>", md: "Private\n" };
		const { pub, priv } = await generateKeys(passphrase);
		const decodedPub = parsePublicKeyFile(parseJson(JSON.stringify(pub)));
		const decodedPriv = parsePrivateKeyFile(parseJson(JSON.stringify(priv)));
		assert.ok(decodedPub);
		assert.ok(decodedPriv);

		const payload = await sealTo(decodedPub, source, "graphite");

		assert.deepEqual(await openWith(decodedPriv, passphrase, payload), source);
		assert.equal(await openWith(decodedPriv, "wrong passphrase", payload), null);

		const tampered = {
			...payload,
			data: `${payload.data.at(0) === "A" ? "B" : "A"}${payload.data.slice(1)}`,
		};
		assert.equal(await openWith(decodedPriv, passphrase, tampered), null);
	});
});
