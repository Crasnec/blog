import {
    Scene,
    defineScene,
    symbolNames,
    symbolGroups,
    symbols,
} from "../../../../components/figures";

const request = defineScene({
    title: "A request, end to end",
    layout: "flow",
    items: [
        { id: "client", visual: "browser", label: "Browser", detail: "Send a request" },
        { id: "api", visual: "server", label: "Application", detail: "Read a record" },
        { id: "db", visual: "database", label: "Database", detail: "Find the data" },
    ],
});

export function RequestScene() {
    return (
        <Scene
            props={request}
            caption="One request passes through three stages. This is a conceptual sequence, not a latency simulation."
        />
    );
}

export function FocusScene() {
    return (
        <Scene
            props={defineScene({
                title: "Explain one step at a time",
                items: request.items,
                steps: [
                    { action: "focus", target: "client" },
                    { action: "transfer", from: "client", to: "api" },
                    { action: "focus", target: "api" },
                    { action: "transfer", from: "api", to: "db" },
                ],
            })}
            caption="The author names the steps; the library handles their timing and path."
        />
    );
}

export function CycleScene() {
    return (
        <Scene
            props={{
                title: "Read · change · write",
                layout: "cycle",
                items: [
                    { id: "read", visual: "download", label: "Read" },
                    { id: "change", visual: "process", label: "Change" },
                    { id: "write", visual: "upload", label: "Write" },
                ],
            }}
            caption="The last stage reconnects to the first. The cycle becomes a vertical loop on a phone."
        />
    );
}

export function StackScene() {
    return (
        <Scene
            props={{
                title: "From an application to a device",
                layout: "stack",
                items: [
                    {
                        id: "app",
                        visual: "window",
                        label: "Application",
                        detail: "Request an operation",
                    },
                    { id: "kernel", visual: "cpu", label: "Kernel", detail: "Check and dispatch" },
                    {
                        id: "driver",
                        visual: "code",
                        label: "Driver",
                        detail: "Speak the device protocol",
                    },
                    {
                        id: "device",
                        visual: "disk",
                        label: "Device",
                        detail: "Perform the operation",
                    },
                ],
            }}
            caption="A stack keeps the same reading order on wide and narrow screens."
        />
    );
}

export function HierarchyScene() {
    return (
        <Scene
            props={defineScene({
                title: "A small filesystem",
                layout: "hierarchy",
                items: [
                    { id: "root", visual: "folder", label: "Project" },
                    { id: "src", visual: "folder", label: "Source", parent: "root" },
                    { id: "app", visual: "code", label: "Application", parent: "src" },
                    { id: "data", visual: "folder", label: "Data", parent: "root" },
                    { id: "record", visual: "file", label: "Records", parent: "data" },
                ],
            })}
            caption="Parent references determine the hierarchy and connection routes."
        />
    );
}

export function ShapeScene() {
    return (
        <Scene
            props={{
                title: "A shared visual vocabulary",
                layout: "grid",
                motion: "reveal",
                items: [
                    { id: "start", visual: "pill", label: "Start" },
                    { id: "step", visual: "rectangle", label: "Process" },
                    { id: "decision", visual: "diamond", label: "Decision" },
                    { id: "storage", visual: "cylinder", label: "Storage" },
                    { id: "input", visual: "parallelogram", label: "Input / output" },
                    { id: "document", visual: "document", label: "Document" },
                ],
            }}
            caption="A prepared shape gives an item a role without requiring drawing code."
        />
    );
}

export function SymbolCatalog() {
    return (
        <>
            {symbolGroups.map((group) => {
                const names = symbolNames.filter((name) => symbols[name].group === group);
                return (
                    <section key={group}>
                        <h3>{group}</h3>
                        {Array.from({ length: Math.ceil(names.length / 12) }, (_, i) => (
                            <Scene
                                key={i}
                                props={{
                                    layout: "grid",
                                    motion: "none",
                                    items: names
                                        .slice(i * 12, i * 12 + 12)
                                        .map((name) => ({ id: name, visual: name, label: name })),
                                }}
                                caption={`${group}: use the printed name as the visual option.`}
                            />
                        ))}
                    </section>
                );
            })}
        </>
    );
}
