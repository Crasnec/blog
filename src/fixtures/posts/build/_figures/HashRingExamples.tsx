/** Post-specific data and captions; all drawing uses reusable typed components. */
import { HashRing, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedServers: FigureInputs["hash-ring"]["servers"] = ["A", "B", "C"];

const keyNames = Array.from({ length: 24 }, (_, i) => `key-${String(i)}`);

const moduloPlacementData = {
    scheme: "modulo",
    servers: sharedServers,
    add: "D",
    keys: keyNames,
} satisfies FigureInputs["hash-ring"];

const virtualNodeRingData = {
    scheme: "ring",
    servers: sharedServers,
    add: "D",
    vnodes: 8,
    keys: keyNames,
} satisfies FigureInputs["hash-ring"];

const singleNodeRingData = {
    scheme: "ring",
    servers: sharedServers,
    add: "D",
    vnodes: 1,
    keys: keyNames,
} satisfies FigureInputs["hash-ring"];

export function ModuloPlacement(input: Partial<DiagramProps<"hash-ring">>) {
    return (
        <HashRing
            props={moduloPlacementData}
            caption="Most keys change servers, although an equal share for D would be only six keys."
            {...input}
        />
    );
}

export function VirtualNodeRing(input: Partial<DiagramProps<"hash-ring">>) {
    return (
        <HashRing
            props={virtualNodeRingData}
            caption="Virtual nodes let D acquire small intervals around the ring; only keys assigned to D move."
            {...input}
        />
    );
}

export function SingleNodeRing(input: Partial<DiagramProps<"hash-ring">>) {
    return (
        <HashRing
            props={singleNodeRingData}
            caption="With one point per server, hash positions determine interval sizes. D receives only one key here."
            {...input}
        />
    );
}
