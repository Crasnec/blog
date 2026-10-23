import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import libraries from "#src/playground/python-libraries.json" with { type: "json" };
import wheels from "#src/playground/python-wheels.json" with { type: "json" };
import { isJsonObject, parseJson } from "#src/utils/json.ts";

/**
 * @typedef {{
 *     name: string,
 *     version: string,
 *     file_name: string,
 *     sha256: string,
 *     depends: string[],
 *     imports: string[],
 *     install_dir: string,
 *     package_type: string,
 * }} PythonPackage
 */
/**
 * @typedef {{
 *     info: import("#src/utils/json.ts").JsonObject,
 *     packages: Record<string, PythonPackage>,
 * }} PythonLock
 */

/**
 * @param {import("#src/utils/json.ts").JsonValue} value
 * @returns {value is PythonPackage}
 */
function isPythonPackage(value) {
    return (
        isJsonObject(value) &&
        typeof value.name === "string" &&
        typeof value.version === "string" &&
        typeof value.file_name === "string" &&
        typeof value.sha256 === "string" &&
        typeof value.install_dir === "string" &&
        typeof value.package_type === "string" &&
        Array.isArray(value.depends) &&
        value.depends.every((entry) => typeof entry === "string") &&
        Array.isArray(value.imports) &&
        value.imports.every((entry) => typeof entry === "string")
    );
}

/**
 * Validate every catalog entry, including packages loaded later in the browser.
 * @param {import("#src/utils/json.ts").JsonValue} value
 * @returns {PythonLock}
 */
export function decodePythonLock(value) {
    if (!isJsonObject(value) || !isJsonObject(value.info) || !isJsonObject(value.packages)) {
        throw new Error("Invalid Pyodide package catalog");
    }
    const packages = Object.entries(value.packages).map(([name, entry]) => {
        if (!isPythonPackage(entry)) {
            throw new Error(`Invalid Pyodide package entry: ${name}`);
        }
        return /** @type {const} */ ([name, entry]);
    });
    return { ...value, info: value.info, packages: Object.fromEntries(packages) };
}

export const supportedPackages = Object.keys(libraries);
const runtimeRoot = dirname(fileURLToPath(import.meta.resolve("pyodide")));

/** Bundle common packages locally and expose the complete versioned catalog. */
export function pythonDistribution() {
    const metadata = parseJson(readFileSync(join(runtimeRoot, "package.json"), "utf8"));
    if (!isJsonObject(metadata) || typeof metadata.version !== "string") {
        throw new Error("Invalid Pyodide runtime version");
    }
    const source = decodePythonLock(
        parseJson(readFileSync(join(runtimeRoot, "pyodide-lock.json"), "utf8")),
    );
    /** @type {Record<string, PythonPackage>} */
    const catalog = { ...source.packages };
    for (const { url, ...entry } of wheels) {
        if (new URL(url).origin !== "https://files.pythonhosted.org")
        {
            throw new Error(`Invalid Python wheel source: ${url}`);
        }
        catalog[entry.name] = entry;
    }
    const wheelURLs = new Map(wheels.map((entry) => [entry.file_name, entry.url]));
    /** @type {Record<string, PythonPackage>} */
    const packages = {};
    /** @param {string} name */
    function add(name) {
        name = name.toLowerCase().replace(/[-_.]+/g, "-");
        if (Object.hasOwn(packages, name)) {
            return;
        }
        const entry = catalog[name];
        if (
            !entry ||
            !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*\.whl$/.test(entry.file_name) ||
            !/^[a-f0-9]{64}$/.test(entry.sha256)
        )
        {
            throw new Error(`Invalid pinned Python package: ${name}`);
        }
        // Normalize dependency keys using Python package-name conventions.
        const depends = entry.depends.map((dependency) =>
            dependency.toLowerCase().replace(/[-_.]+/g, "-"),
        );
        packages[name] = { ...entry, depends };
        for (const dependency of depends) {
            add(dependency);
        }
    }
    for (const name of [...supportedPackages, "micropip"]) {
        add(name);
    }
    const cache = fileURLToPath(new URL(`../.cache/python/${metadata.version}/`, import.meta.url));
    const base = `https://cdn.jsdelivr.net/pyodide/v${metadata.version}/full/`;
    return {
        version: metadata.version,
        cache,
        runtimeRoot,
        lock: {
            ...source,
            packages: Object.fromEntries(
                Object.entries(catalog).map(([name, entry]) => [
                    name,
                    {
                        ...entry,
                        // Bundled wheels remain same-origin; other packages load on demand.
                        file_name: Object.hasOwn(packages, name)
                            ? entry.file_name
                            : new URL(entry.file_name, base).href,
                    },
                ]),
            ),
        },
        files: Object.values(packages).map((entry) => ({
            ...entry,
            path: join(cache, entry.file_name),
            url: wheelURLs.get(entry.file_name) ?? new URL(entry.file_name, base).href,
        })),
    };
}

/** @param {Uint8Array} content @param {string} expected */
export function verifyPackage(content, expected) {
    return createHash("sha256").update(content).digest("hex") === expected;
}

/** Download once at development/build time; browsers use same-origin assets. */
export async function preparePythonPackages() {
    const distribution = pythonDistribution();
    await mkdir(distribution.cache, { recursive: true });
    const pending = [...distribution.files];
    await Promise.all(
        Array.from({ length: 3 }, async () => {
            for (let entry = pending.pop(); entry; entry = pending.pop()) {
                try {
                    if (verifyPackage(await readFile(entry.path), entry.sha256)) {
                        continue;
                    }
                } catch {
                    /* A missing or invalid cached wheel is fetched below. */
                }
                const response = await fetch(entry.url, {
                    signal: AbortSignal.timeout(60_000),
                    redirect: "error",
                });
                if (!response.ok)
                {
                    throw new Error(
                        `Python package ${entry.name}: HTTP ${String(response.status)}`,
                    );
                }
                const content = new Uint8Array(await response.arrayBuffer());
                if (!verifyPackage(content, entry.sha256))
                {
                    throw new Error(`Python package ${entry.name}: SHA-256 mismatch`);
                }
                const temporary = `${entry.path}.${randomUUID()}.tmp`;
                try {
                    await writeFile(temporary, content);
                    await rename(temporary, entry.path);
                } finally {
                    await rm(temporary, { force: true });
                }
            }
        }),
    );
    console.info(
        `Python packages: verified ${String(distribution.files.length)} pinned wheels for Pyodide ${distribution.version}`,
    );
    return distribution;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await preparePythonPackages();
}
