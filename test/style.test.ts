import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint, Linter } from "eslint";
import stylistic from "@stylistic/eslint-plugin";
import astroParser from "astro-eslint-parser";
import tseslint from "typescript-eslint";
import { sourceStyleRules } from "#root/eslint.config.mjs";

const engine = new ESLint();
const linter = new Linter();

void test("JavaScript modules reject unchecked JSON assignments and member access", async () => {
    const results = await engine.lintText(
        'const record = JSON.parse("{}");\nconsole.log(record.value);\n',
        { filePath: "scripts/python-packages.mjs" },
    );
    const rules = results.flatMap((result) => result.messages.map((message) => message.ruleId));
    assert.ok(rules.includes("@typescript-eslint/no-unsafe-assignment"));
    assert.ok(rules.includes("@typescript-eslint/no-unsafe-member-access"));
});

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
        rules: Object.fromEntries(
            Object.keys(sourceStyleRules).map((rule) => [rule, effective.rules?.[rule] ?? "off"]),
        ),
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

void test("control flow requires braces and multiline bodies in every source syntax", async () => {
    for (const file of ["src/config.ts", "eslint.config.mjs", "src/components/Figure.tsx"]) {
        const config = await styleConfig(file);
        for (const [source, expected] of [
            ["if (ready) answer();", "if (ready) {\n    answer();\n}"],
            ["if (ready) { answer(); }", "if (ready) {\n    answer();\n}"],
            [
                "if (ready) {\n    answer();\n} else retry();",
                "if (ready) {\n    answer();\n} else {\n    retry();\n}",
            ],
            ["for (const item of items) visit(item);", "for (const item of items) {\n    visit(item);\n}"],
            ["for (const key in object) visit(key);", "for (const key in object) {\n    visit(key);\n}"],
            ["for (let i = 0; i < 3; i++) visit(i);", "for (let i = 0; i < 3; i++) {\n    visit(i);\n}"],
            ["while (ready) tick();", "while (ready) {\n    tick();\n}"],
            ["do tick(); while (ready);", "do {\n    tick();\n} while (ready);"],
        ] as const) {
            const messages = linter.verify(source, config, { filename: file });
            assert.ok(messages.some((message) => message.ruleId === "curly"
                || message.ruleId === "@stylistic/curly-newline"), `${file}: ${source}`);
            const result = linter.verifyAndFix(source, config, { filename: file });
            assert.deepEqual(result.messages, [], `${file}: ${source}`);
            const output = result.output.split("\n").map((line) => line.trimEnd()).join("\n");
            assert.equal(output.trimEnd(), expected.trimEnd(), `${file}: ${source}`);
        }
    }
    const file = "src/components/CategoryTree.astro";
    const source = "---\nif (ready) answer();\n---\n<p>Done</p>\n";
    const result = linter.verifyAndFix(source, await styleConfig(file), { filename: file });
    assert.deepEqual(result.messages, []);
    assert.equal(result.output, "---\nif (ready) {\n    answer();\n}\n---\n<p>Done</p>\n");
});

void test("adjacent declared, exported and variable-bound functions have one blank line", async () => {
    const file = "src/config.ts";
    const config = await styleConfig(file);
    for (const [first, second] of [
        ["function first() {}", "function second() {}"],
        ["export function first() {}", "export async function second() {}"],
        ["const first = () => 1;", "const second = () => 2;"],
        ["const first = function () {};", "const second = async function () {};"],
        ["export const first = () => 1;", "export const second = () => 2;"],
        ["function first() {}", "const second = () => 2;"],
        ["const first = () => 1;", "export default function second() {}"],
        ["first = () => 1;", "second = function () {};"],
    ] as const) {
        for (const separator of ["\n", "\n\n\n"]) {
            const result = linter.verifyAndFix(`${first}${separator}${second}\n`, config, {
                filename: file,
            });
            assert.deepEqual(result.messages, [], first);
            assert.equal(result.output, `${first}\n\n${second}\n`, first);
        }
    }
    const source = "function first() {}\n/** Second function. */\nfunction second() {}\n";
    const result = linter.verifyAndFix(source, config, { filename: file });
    assert.deepEqual(result.messages, []);
    assert.equal(result.output, "function first() {}\n\n/** Second function. */\nfunction second() {}\n");
});

void test("class methods are separated while ordinary data fields and variables stay adjacent", async () => {
    const file = "src/config.ts";
    const config = await styleConfig(file);
    const source = "class Example {\n    value = 1;\n    other = 2;\n    first() {}\n    second() {}\n}\n";
    const result = linter.verifyAndFix(source, config, { filename: file });
    assert.deepEqual(result.messages, []);
    assert.equal(result.output, source.replace("    second()", "\n    second()"));
    const variables = "const first = 1;\nconst second = 2;\nconst values = [1].map(() => 2);\n";
    assert.deepEqual(linter.verify(variables, config, { filename: file }), []);
    const callback = "const first = () => 1;\nconst values = [1].map(() => {\n    const local = () => 2;\n    return local();\n});\n";
    assert.deepEqual(linter.verify(callback, config, { filename: file }), []);
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
    const lesson = "if (ready) {\n\tconst code = `def answer():\n\n\n\treturn 42\n`;\n}\n";
    const fixed = linter.verifyAndFix(lesson, config, { filename: file });
    assert.deepEqual(fixed.messages, []);
    assert.ok(fixed.output.includes("def answer():\n\n\n\treturn 42\n"));
});
