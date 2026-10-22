import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import test from "node:test";
import postcss, { type Root } from "postcss";
import fontFaceGroups from "../scripts/font-face-groups.ts";

async function packageStyles(): Promise<Root> {
    const root = postcss.root();
    for (const weight of [400, 500, 600, 700]) {
        const url = import.meta.resolve(`@fontsource/ibm-plex-sans-kr/${String(weight)}.css`);
        const from = fileURLToPath(url);
        root.append(postcss.parse(await readFile(from, "utf8"), { from }));
    }
    return root;
}

function faceSequences(root: Root): Map<string, string[]> {
    const sequences = new Map<string, string[]>();
    root.walkAtRules("font-face", (face) => {
        let weight = "";
        face.walkDecls("font-weight", (declaration) => {
            weight = declaration.value;
        });
        const sequence = sequences.get(weight) ?? [];
        sequence.push(face.toString());
        sequences.set(weight, sequence);
    });
    return sequences;
}

void test("package fonts compress better without changing any face or per-weight order", async () => {
    const before = await packageStyles();
    const sequences = faceSequences(before);
    const originalSize = gzipSync(before.toString()).byteLength;
    const result = await postcss([fontFaceGroups()]).process(before.clone(), { from: undefined });
    assert.deepEqual(faceSequences(result.root), sequences);
    assert.ok(gzipSync(result.css).byteLength < originalSize * 0.7);
    const repeated = await postcss([fontFaceGroups()]).process(result.root, { from: undefined });
    assert.equal(repeated.css, result.css);
});

void test("custom font overrides and nested faces retain their original cascade", async () => {
    const custom = postcss.parse(`
        @font-face {
            font-family: "IBM Plex Sans KR";
            font-style: normal;
            font-weight: 400;
            src: url(custom.woff2);
            unicode-range: U+AC00-D7A3;
        }
    `, { from: "/custom-fonts.css" });
    const root = await packageStyles();
    root.append(custom);
    const css = root.toString();
    const result = await postcss([fontFaceGroups()]).process(root, { from: undefined });
    assert.equal(result.css, css);

    const nested = await packageStyles();
    const media = postcss.atRule({ name: "media", params: "print" });
    const face = nested.nodes.find((node) => node.type === "atrule");
    assert.ok(face);
    media.append(face.clone());
    nested.append(media);
    const nestedCss = nested.toString();
    const nestedResult = await postcss([fontFaceGroups()]).process(nested, { from: undefined });
    assert.equal(nestedResult.css, nestedCss);
});
