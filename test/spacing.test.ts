import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkSpacing, indentationTabLines } from "../scripts/check-spacing.mjs";

const run = promisify(execFile);

void test("spacing checks indentation without rejecting interior or escaped data tabs", () => {
    const source = "    spaces\r\n \tindent\rname\tvalue\nconst tab = '\\t';\n\t";
    assert.deepEqual(indentationTabLines(source), [2, 5]);
});

void test("spacing checks tracked and new authored formats, preserving upstream and binary files",
    async (context) => {
        const root = await mkdtemp(join(tmpdir(), "blog-spacing-"));
        context.after(() => rm(root, { recursive: true, force: true }));
        await run("git", ["init", "--quiet"], { cwd: root });
        const files = new Map<string, string | Buffer>([
            ["style.css", ".sample {\n\tcolor: red;\n}\n"],
            ["component.astro", "<!--\n \tA comment.\n-->\n"],
            ["README.md", "```ts\n\tconst example = 1;\n```\n"],
            ["public/labs/example.py", "if True:\n\tprint('hello')\n"],
            ["vendor/source.dct", "\tupstream input\n"],
            ["vendor/owned.py", "\tprint('owned')\n"],
            ["interior.tsv", "name\tvalue\n"],
            ["escaped.ts", "const tab = '\\t';\n"],
            ["binary.bin", Buffer.from([9, 65, 0])],
            ["invalid.bin", Buffer.from([9, 255, 10])],
            ["deleted.css", "\tdeleted\n"],
            ["ignored.css", "\tignored\n"],
        ]);
        for (const [path, contents] of files) {
            const fullPath = join(root, path);
            await mkdir(dirname(fullPath), { recursive: true });
            await writeFile(fullPath, contents);
        }
        await run("git", ["add", "style.css", "deleted.css"], { cwd: root });
        await rm(join(root, "deleted.css"));
        await writeFile(join(root, ".gitignore"), "ignored.css\nstyle.css\n");
        await writeFile(join(root, ".spacingignore"), "# Preserve imported input\nvendor/*.dct\n");

        assert.deepEqual(await checkSpacing(root), [
            { path: "README.md", line: 2 },
            { path: "component.astro", line: 2 },
            { path: "public/labs/example.py", line: 2 },
            { path: "style.css", line: 2 },
            { path: "vendor/owned.py", line: 1 },
        ]);
        const checker = fileURLToPath(new URL("../scripts/check-spacing.mjs", import.meta.url));
        await assert.rejects(run(process.execPath, [checker], { cwd: root }), {
            code: 1,
            stderr: /style\.css:2: use spaces for indentation/u,
        });
        for (const [path, contents] of files) {
            if (path !== "deleted.css") {
                assert.deepEqual(await readFile(join(root, path)), Buffer.from(contents));
            }
        }
    });
