import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import libraries from "../src/playground/python-libraries.json" with { type: "json" };

/** @typedef {{name: string, version: string, file_name: string, sha256: string, depends: string[], imports: string[], install_dir: string, package_type: string}} PythonPackage */
/** @typedef {{info: object, packages: Record<string, PythonPackage>}} PythonLock */

export const supportedPackages = Object.keys(libraries);
const runtimeRoot = dirname(fileURLToPath(import.meta.resolve("pyodide")));

// Seaborn's official pure-Python wheel is not in Pyodide's package catalog.
// Pin its PyPI artifact and digest; its native dependencies come from Pyodide.
const seaborn = {
	name: "seaborn", version: "0.13.2", file_name: "seaborn-0.13.2-py3-none-any.whl",
	sha256: "636f8336facf092165e27924f223d3c62ca560b1f2bb5dff7ab7fad265361987",
	depends: ["numpy", "pandas", "matplotlib", "scipy"], imports: ["seaborn"],
	install_dir: "site", package_type: "package",
};
const seabornURL = "https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl";

/** Resolve only the approved roots and their pinned transitive dependencies. */
export function pythonDistribution() {
	/** @type {{version: string}} */
	const metadata = JSON.parse(readFileSync(join(runtimeRoot, "package.json"), "utf8"));
	/** @type {PythonLock} */
	const source = JSON.parse(readFileSync(join(runtimeRoot, "pyodide-lock.json"), "utf8"));
	/** @type {Record<string, PythonPackage>} */
	const catalog = { ...source.packages, seaborn };
	/** @type {Record<string, PythonPackage>} */
	const packages = {};
	/** @param {string} name */
	function add(name) {
		if (Object.hasOwn(packages, name)) return;
		const entry = catalog[name];
		if (!entry || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*\.whl$/.test(entry.file_name) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid pinned Python package: ${name}`);
		packages[name] = entry;
		for (const dependency of entry.depends) add(dependency);
	}
	for (const name of supportedPackages) add(name);
	const cache = fileURLToPath(new URL(`../.cache/python/${metadata.version}/`, import.meta.url));
	const base = `https://cdn.jsdelivr.net/pyodide/v${metadata.version}/full/`;
	return {
		version: metadata.version, cache, runtimeRoot,
		lock: { ...source, packages },
		files: Object.values(packages).map((entry) => ({
			...entry, path: join(cache, entry.file_name),
			url: entry.name === "seaborn" ? seabornURL : new URL(entry.file_name, base).href,
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
	await Promise.all(Array.from({ length: 3 }, async () => {
		for (let entry = pending.pop(); entry; entry = pending.pop()) {
			try {
				if (verifyPackage(await readFile(entry.path), entry.sha256)) continue;
			} catch { /* A missing or invalid cached wheel is fetched below. */ }
			const response = await fetch(entry.url, { signal: AbortSignal.timeout(60_000), redirect: "error" });
			if (!response.ok) throw new Error(`Python package ${entry.name}: HTTP ${String(response.status)}`);
			const content = new Uint8Array(await response.arrayBuffer());
			if (!verifyPackage(content, entry.sha256)) throw new Error(`Python package ${entry.name}: SHA-256 mismatch`);
			const temporary = `${entry.path}.${randomUUID()}.tmp`;
			try { await writeFile(temporary, content); await rename(temporary, entry.path); }
			finally { await rm(temporary, { force: true }); }
		}
	}));
	console.info(`Python packages: verified ${String(distribution.files.length)} pinned wheels for Pyodide ${distribution.version}`);
	return distribution;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await preparePythonPackages();
