/** Different domains exercise the same reusable diagram components. */
import {
    Line,
    Distribution,
    Sort,
    Heatmap,
    HashRing,
    GridSearch,
} from "#src/components/figures/index.tsx";

const measurements = [-4, -1, 2, 0, -2, 3];

export function SignedLine() {
    return (
        <Line
            props={{
                series: [
                    {
                        label: "Deviation",
                        values: measurements,
                    },
                ],
                unit: "Difference from baseline",
            }}
            caption="Negative and positive values share one axis."
        />
    );
}

export function SignedDistribution() {
    return (
        <Distribution
            props={{
                groups: [
                    {
                        label: "Deviation",
                        samples: measurements,
                    },
                ],
                markers: [50],
            }}
            caption="The distribution axis automatically includes negative observations."
        />
    );
}

export function SignedSort() {
    return (
        <Sort
            props={{
                algorithm: "merge",
                values: measurements,
            }}
            caption="The same sorting algorithm compares values above and below zero."
        />
    );
}

export function ConstantSort() {
    return (
        <Sort
            props={{
                algorithm: "quick",
                values: [0, 0, 0, 0],
            }}
            caption="All-zero input still preserves the comparison trace and final state."
        />
    );
}

export function ConstantHeatmap() {
    return (
        <Heatmap
            props={{
                rows: ["Control", "Treatment"],
                cols: ["1", "2", "3"],
                values: [
                    [-2, -2, -2],
                    [-2, -2, -2],
                ],
                highlight: 0,
            }}
            caption="A constant matrix remains valid; its automatic colour range surrounds the shared value."
        />
    );
}

export function NamedKeys() {
    return (
        <HashRing
            props={{
                scheme: "modulo",
                servers: ["node-a", "node-b"],
                add: "node-c",
                keys: ["user:42", "order:7", "cache:9", "user:108"],
            }}
            caption="Server assignments come from hashing actual key strings."
        />
    );
}

export function UnreachableMaze() {
    return (
        <GridSearch
            props={{ algorithm: "bfs", maze: ["S#G", "###", "..."] }}
            caption="Exhausting reachable cells leaves an explicit no-path result."
        />
    );
}
