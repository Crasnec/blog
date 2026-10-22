import { MAX_OUTPUT, MAX_PLOTS, MAX_PNG, MAX_PLOT_TOTAL, type RunResponse } from "./contracts.ts";

type ConsoleValue = object | string | number | boolean | bigint | symbol | null | undefined;

export function formatValue(value: ConsoleValue): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value !== "object" || value === null) return String(value);
    const seen = new WeakSet<object>();
    try {
        // toJSON may return undefined, despite the standard library's string type.
        const encoded = JSON.stringify(
            value,
            (_key: string, item: ConsoleValue) => {
                if (typeof item === "bigint") return `${String(item)}n`;
                if (typeof item === "object" && item !== null) {
                    if (seen.has(item)) return "[Circular]";
                    seen.add(item);
                }
                return item;
            },
            2,
        ) as string | undefined;
        return encoded ?? "[Unserializable object]";
    } catch {
        return "[Unserializable object]";
    }
}

/** A private channel keeps evaluated code's postMessage out of the UI protocol. */
export function outputChannel(port: MessagePort) {
    let size = 0;
    let lines = 0;
    let plots = 0;
    let plotBytes = 0;
    return (message: RunResponse) => {
        if (message.type === "output") {
            size += message.text.length;
            if (++lines > 500 || size > MAX_OUTPUT)
                throw new Error("Output limit exceeded (500 messages / 64 KB)");
        }
        if (message.type === "plot") {
            plotBytes += message.png.byteLength;
            if (
                ++plots > MAX_PLOTS ||
                message.png.byteLength > MAX_PNG ||
                plotBytes > MAX_PLOT_TOTAL
            )
                throw new Error("Plot limit exceeded (8 images / 4 MB each / 16 MB total)");
            port.postMessage(message, [message.png]);
            return;
        }
        port.postMessage(message);
    };
}
