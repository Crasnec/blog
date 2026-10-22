import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, matchesGlob, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

/** @param {string} path @returns {Promise<string | null>} */
async function readText(path) {
    let bytes;
    try {
        bytes = await readFile(path);
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
    if (bytes.includes(0)) {
        return null;
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return null;
    }
}

/** @param {string} source @returns {number[]} */
export function indentationTabLines(source) {
    return source.split(/\r\n|\n|\r/u).flatMap((line, index) =>
        /^[ \t]*\t/u.test(line) ? [index + 1] : [],
    );
}

/**
 * Inspect authored text without rewriting strings, examples, or data.
 * @param {string} root
 * @returns {Promise<{ path: string, line: number }[]>}
 */
export async function checkSpacing(root) {
    const ignoreSource = await readText(join(root, ".spacingignore"));
    const ignored = (ignoreSource ?? "").split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"));
    const { stdout } = await run(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    /** @type {{ path: string, line: number }[]} */
    const findings = [];
    for (const path of [...new Set(stdout.split("\0"))].filter(Boolean).sort()) {
        if (ignored.some((pattern) => matchesGlob(path, pattern))) {
            continue;
        }
        const source = await readText(join(root, path));
        if (source !== null) {
            findings.push(...indentationTabLines(source).map((line) => ({ path, line })));
        }
    }
    return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const findings = await checkSpacing(process.cwd());
    for (const { path, line } of findings) {
        console.error(`${path}:${String(line)}: use spaces for indentation`);
    }
    if (findings.length > 0) {
        process.exitCode = 1;
    }
}
