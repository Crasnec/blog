import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { stringify } from "yaml";

import { publicFrontmatter } from "../scripts/secret.mjs";
import { parseJson } from "../src/utils/json.ts";
import { parsePostOrder, parseSeriesMetadata } from "../src/posts/post-order.ts";
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
    void test("public ordering metadata survives sealing and opening frontmatter", () => {
        const metadata = {
            title: "Private chapter",
            published: new Date("2026-01-01T00:00:00Z"),
            order: 8,
            series: { name: "  Statistics  ", order: 2 },
            sealed: { data: "ciphertext" },
        };
        const expected = {
            title: "Private chapter",
            published: "2026-01-01",
            order: 8,
            series: { name: "Statistics", order: 2 },
        };
        const visible = publicFrontmatter(metadata);
        assert.deepEqual(visible, expected);
        const reopened = parseFrontmatter(`---\n${stringify(visible)}---\nBody`);
        assert.deepEqual(publicFrontmatter(reopened.frontmatter), expected);
        assert.deepEqual(publicFrontmatter({ title: "No ordering" }), { title: "No ordering" });
    });

    void test("ordering metadata rejects invalid values before sealing or opening", () => {
        assert.equal(parsePostOrder(undefined), undefined);
        assert.equal(parseSeriesMetadata(undefined), undefined);
        for (const order of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
            assert.throws(
                () => publicFrontmatter({ order }),
                /order must be a positive safe integer/,
            );
            assert.throws(
                () => publicFrontmatter({ series: { name: "Series", order } }),
                /series.order must be a positive safe integer/,
            );
        }
        for (const series of [null, [], { name: "  ", order: 1 }, { name: 1, order: 1 }]) {
            assert.throws(() => publicFrontmatter({ series }), /series.name/);
        }
        assert.throws(() => publicFrontmatter({ series: { name: "Series" } }), /series.order/);
    });

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

    void test(
        "seals and opens a post only with the matching passphrase",
        { timeout: 15_000 },
        async () => {
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
        },
    );
});
