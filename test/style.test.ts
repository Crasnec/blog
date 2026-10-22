import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint, Linter } from "eslint";
import stylistic from "@stylistic/eslint-plugin";
import astroParser from "astro-eslint-parser";
import tseslint from "typescript-eslint";

const engine = new ESLint();
const linter = new Linter();

async function styleConfig(file: string): Promise<Linter.Config> {
    const effective = (await engine.calculateConfigForFile(file)) as Linter.Config | undefined;
    assert.ok(effective?.rules);
    return {
        files: ["**/*.{ts,tsx,mjs,astro}"],
        languageOptions: {
            parser: file.endsWith(".astro") ? astroParser : tseslint.parser,
            parserOptions: { parser: tseslint.parser, ecmaVersion: "latest", sourceType: "module" },
        },
        plugins: { "@stylistic": stylistic },
        rules: {
            "@stylistic/indent": effective.rules["@stylistic/indent"] ?? "off",
            "@stylistic/semi": effective.rules["@stylistic/semi"] ?? "off",
            "@stylistic/max-len": effective.rules["@stylistic/max-len"] ?? "off",
        },
    };
}

void test("project rules fix four-space indentation and semicolons in every source syntax", async () => {
    for (const [file, source, expected] of [
        ["src/config.ts", "if (ready) {\n\tanswer()\n}\n", "if (ready) {\n    answer();\n}\n"],
        ["eslint.config.mjs", "if (ready) {\n  answer()\n}\n", "if (ready) {\n    answer();\n}\n"],
        [
            "src/components/Figure.tsx",
            "const view = (\n<section>\n\t<p>Hello</p>\n</section>\n)\n",
            "const view = (\n    <section>\n        <p>Hello</p>\n    </section>\n);\n",
        ],
        [
            "src/components/CategoryTree.astro",
            "---\nconst value = 1\n---\n<section>\n\t<p>{value}</p>\n</section>\n",
            "---\nconst value = 1;\n---\n<section>\n    <p>{value}</p>\n</section>\n",
        ],
    ] as const) {
        const result = linter.verifyAndFix(source, await styleConfig(file), { filename: file });
        assert.deepEqual(result.messages, [], file);
        assert.equal(result.output, expected, file);
    }
});

void test("100 characters is a hard limit for ordinary code and comments", async () => {
    const file = "src/config.ts";
    const config = await styleConfig(file);
    assert.deepEqual(linter.verify(`// ${"x".repeat(97)}\n`, config, { filename: file }), []);
    const comment = linter.verify(`// ${"x".repeat(98)}\n`, config, { filename: file });
    assert.equal(comment[0]?.ruleId, "@stylistic/max-len");
    const code = `const total = [${Array.from({ length: 40 }, (_, index) => String(index)).join(", ")}];\n`;
    assert.equal(linter.verify(code, config, { filename: file })[0]?.ruleId, "@stylistic/max-len");
});

void test("URLs, strings, template literals and regular expressions may exceed the limit", async () => {
    const file = "src/config.ts";
    const config = await styleConfig(file);
    const long = "x".repeat(150);
    for (const source of [
        `// https://example.com/${long}\n`,
        `const text = '${long}';\n`,
        `const text = "${long}";\n`,
        `const text = \`${long}\`;\n`,
        `const pattern = /${long}/u;\n`,
    ]) {
        assert.deepEqual(linter.verify(source, config, { filename: file }), []);
    }
    const lesson = "if (ready) {\n\tconst code = `def answer():\n\treturn 42\n`;\n}\n";
    const fixed = linter.verifyAndFix(lesson, config, { filename: file });
    assert.deepEqual(fixed.messages, []);
    assert.ok(fixed.output.includes("def answer():\n\treturn 42\n"));
});
