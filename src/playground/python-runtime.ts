import type { loadPyodide, PyodideAPI } from "pyodide";
import type { MessageValue } from "./contracts.ts";

type RuntimeFunction = (...args: MessageValue[]) => MessageValue;
type PackageOptions = Parameters<PyodideAPI["loadPackagesFromImports"]>[1];
const isRecord = (value: MessageValue): value is Record<string, MessageValue> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const isFunction = (value: MessageValue): value is RuntimeFunction => typeof value === "function";

function method(record: Record<string, MessageValue>, name: string): RuntimeFunction {
    const member = record[name];
    if (!isFunction(member)) throw new Error(`Python runtime is missing ${name}()`);
    return member.bind(record);
}

/** Decode the dynamically served runtime without assuming its exports or Python results. */
export async function initializePythonRuntime(
    module: MessageValue,
    options: Parameters<typeof loadPyodide>[0],
) {
    if (!isRecord(module)) throw new Error("Invalid Python runtime module");
    const runtime = await Promise.resolve(method(module, "loadPyodide")(options));
    if (!isRecord(runtime)) throw new Error("Invalid Python runtime instance");
    const runPython = method(runtime, "runPython");
    const runPythonAsync = method(runtime, "runPythonAsync");
    const registerJsModule = method(runtime, "registerJsModule");
    const loadPackage = method(runtime, "loadPackage");
    const loadPackagesFromImports = method(runtime, "loadPackagesFromImports");
    return {
        runPython(code: string): void {
            runPython(code);
        },
        runPythonString(code: string): string {
            const value = runPython(code);
            if (typeof value !== "string")
                throw new Error("Python did not return the expected text");
            return value;
        },
        async runPythonAsync(code: string): Promise<void> {
            await Promise.resolve(runPythonAsync(code));
        },
        registerJsModule(name: string, values: object): void {
            registerJsModule(name, values);
        },
        async loadPackage(name: string, settings: PackageOptions): Promise<void> {
            await Promise.resolve(loadPackage(name, settings));
        },
        async loadPackagesFromImports(code: string, settings: PackageOptions): Promise<void> {
            await Promise.resolve(loadPackagesFromImports(code, settings));
        },
        isPackageLoaded(name: string): boolean {
            if (!isRecord(runtime.loadedPackages))
                throw new Error("Invalid Python package registry");
            return Object.hasOwn(runtime.loadedPackages, name);
        },
    };
}
