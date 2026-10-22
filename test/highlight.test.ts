import assert from "node:assert/strict";
import { after, test } from "node:test";
import { EditorState } from "@codemirror/state";
import { createCssVariablesTheme, createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import javascript from "shiki/langs/javascript.mjs";
import typescript from "shiki/langs/typescript.mjs";
import python from "shiki/langs/python.mjs";
import { IncrementalHighlighter } from "../src/playground/incremental-highlight.ts";
import { highlights, setTokens } from "../src/playground/highlight-decorations.ts";
import { parseGrammars } from "../src/playground/grammar.ts";
import type { HighlightToken } from "../src/playground/contracts.ts";

const theme = "test-editor";
const engine = await createHighlighterCore({
    engine: createOnigurumaEngine(import("shiki/wasm")),
    themes: [createCssVariablesTheme({ name: theme })],
    langs: [
        javascript,
        typescript,
        python,
        ...parseGrammars([
            {
                filename: "captured-delimiter.json",
                content: JSON.stringify({
                    scopeName: "source.captured",
                    patterns: [{ name: "string.quoted", begin: "(a|b)<<", end: "\\1>>" }],
                }),
            },
        ]),
    ],
});
after(() => {
    engine.dispose();
});

function complete(code: string, language: string): HighlightToken[] {
    return engine.codeToTokensBase(code, { lang: language, theme }).flatMap((line) =>
        line
            .filter((token) => token.content.length > 0)
            .map((token) => ({
                from: token.offset,
                to: token.offset + token.content.length,
                color: token.color ?? "var(--shiki-foreground)",
                fontStyle: token.fontStyle ?? 0,
            })),
    );
}

void test("a 2000-line document only tokenizes the changed line and sends its replacement", () => {
    const cache = new IncrementalHighlighter(engine, theme);
    const lines = Array.from(
        { length: 2000 },
        (_, index) => `value_${String(index)} = ${String(index)}`,
    );
    const initial = cache.highlight(1, 1, undefined, lines.join("\n"), "python");
    assert.equal(initial.tokenizedLines, 2000);
    lines[0] = "value_0 = 12345";
    const first = cache.highlight(1, 2, 1, lines.join("\n"), "python");
    assert.equal(first.tokenizedLines, 1);
    assert.equal(first.from, 0);
    assert.equal(first.to, lines[0].length + 1);
    assert.ok(first.tokens.length < 10);
    lines[1999] = 'value_1999 = "last"';
    const last = cache.highlight(1, 3, 2, lines.join("\n"), "python");
    assert.equal(last.tokenizedLines, 1);
    assert.ok(last.from > 30_000);
    assert.deepEqual(
        cache.highlight(1, 4, undefined, lines.join("\n"), "python").tokens,
        complete(lines.join("\n"), "python"),
    );
});

void test("incremental state matches a fresh parse through multiline edits, insertions and deletions", () => {
    const scenarios = [
        {
            language: "python",
            codes: [
                'a = 1\ns = """first\nsecond\n"""\na = 2\n',
                'a = 1\ns = """first\nsecond\na = 2\n',
                'a = 1\ns = "first"\nsecond\na = 2\n',
                'a = 1\ns = "first"\n\nsecond\na = 2\n',
                's = "first"\n\nsecond\na = 2',
                "",
                "\n",
                "x = 2\r\ny = 3\r\n",
                "x = 2\ny = 3\n",
            ],
        },
        {
            language: "javascript",
            codes: [
                "const x = 1;\n/* note\nmore */\nconsole.log(x);",
                "const x = 1;\n/* note\nmore\nconsole.log(x);",
                "const x = 1;\nnote\nmore\nconsole.log(x);",
                "const x = `hello\n${1 + 2}\nworld`;\nconsole.log(x);",
                "const x = `hello\n${1 + 3}\nworld`;\nconsole.log(x);",
            ],
        },
        {
            language: "typescript",
            codes: [
                'type Name = string;\nconst x: Name = "a";\nconsole.log(x);',
                "type Name = number;\nconst x: Name = 1;\nconsole.log(x);",
            ],
        },
        {
            language: "custom-0",
            codes: [
                "a<<\ntext\na>>\nplain\nb>>\nend",
                "b<<\ntext\na>>\nplain\nb>>\nend",
                "b<<\ntext\nb>>\nplain\nb>>\nend",
            ],
        },
        { language: "text", codes: ["one\ntwo", "one\nnew\ntwo", "two"] },
    ];
    for (const { language, codes } of scenarios) {
        const cache = new IncrementalHighlighter(engine, theme);
        for (const [index, code] of codes.entries()) {
            const id = index + 1;
            const patch = cache.highlight(1, id, index || undefined, code, language);
            const expected = complete(code, language);
            assert.deepEqual(
                patch.tokens,
                expected.filter((token) => token.from >= patch.from && token.to <= patch.to),
                `${language} revision ${String(id)}`,
            );
            assert.deepEqual(cache.highlight(1, id, undefined, code, language).tokens, expected);
        }
    }
});

void test("notebook cells keep independent states and stale bases receive a complete safe response", () => {
    const cache = new IncrementalHighlighter(engine, theme);
    cache.highlight(1, 1, undefined, 'x = """open', "python");
    const independent = cache.highlight(2, 1, undefined, "x = 2", "python");
    assert.deepEqual(independent.tokens, complete("x = 2", "python"));
    cache.highlight(2, 2, 1, "x = 3\ny = 2", "python");
    const catchup = cache.highlight(2, 3, 1, "x = 3\ny = 4", "python");
    assert.equal(catchup.from, 0);
    assert.equal(catchup.to, "x = 3\ny = 4".length);
    assert.deepEqual(catchup.tokens, complete("x = 3\ny = 4", "python"));
    cache.release(2);
    assert.equal(cache.highlight(2, 4, 3, "x = 3\ny = 4", "python").tokenizedLines, 2);
});

void test("existing marks stay mapped during typing, and a patch preserves marks on other lines", () => {
    let state = EditorState.create({ doc: "a = 1\nb = 2", extensions: [highlights] });
    const tokens = complete(state.doc.toString(), "python");
    state = state.update({
        effects: setTokens.of({ from: 0, to: state.doc.length, tokens }),
    }).state;
    const count = state.field(highlights).size;
    state = state.update({ changes: { from: 0, insert: "x" } }).state;
    assert.equal(state.field(highlights).size, count, "typing must not clear highlighting");
    const expected = complete(state.doc.toString(), "python");
    state = state.update({
        effects: setTokens.of({
            from: 0,
            to: 7,
            tokens: expected.filter((token) => token.to <= 7),
        }),
    }).state;
    const ranges: { from: number; to: number }[] = [];
    state.field(highlights).between(0, state.doc.length, (from, to) => {
        ranges.push({ from, to });
    });
    assert.deepEqual(
        ranges,
        expected.map(({ from, to }) => ({ from, to })),
    );
});
