/** Reusable deterministic model, independent of canvas rendering and post data. */
import { hash32 } from "#src/figures/kit.ts";

/** Where a string lands on the ring, as a turn from 0 to 1. */
export const turnOf = (s: string) => hash32(s) / 2 ** 32;

export type Scheme = "ring" | "modulo";

export interface RingPoint {
    server: number;
    at: number;
}

export interface Key {
    name: string;
    at: number;
    before: number;
    after: number;
    slotBefore: number;
    slotAfter: number;
    /** Order among the keys that move, or -1 if this one stays. */
    moveRank: number;
}

export interface Plan {
    scheme: Scheme;
    /** All servers; the added one is last. */
    servers: string[];
    vnodes: number;
    before: RingPoint[];
    after: RingPoint[];
    keys: Key[];
    moved: number;
    /** The most keys any column holds at once, for sizing the chips. */
    slots: number;
}

function ringPoints(servers: string[], vnodes: number): RingPoint[] {
    return servers
        .flatMap((name, server) =>
            Array.from({ length: vnodes }, (_, k) => ({
                server,
                at: turnOf(`${name}#${String(k)}`),
            })),
        )
        .sort((a, b) => a.at - b.at);
}

/** The first point clockwise from `at`, wrapping round past 1. */
function ownerOnRing(points: RingPoint[], at: number): number {
    return (points.find((p) => p.at >= at) ?? points[0])?.server ?? 0;
}

export function planHashing(
    scheme: Scheme,
    servers: string[],
    add: string,
    names: string[],
    vnodes: number,
): Plan {
    const all = [...servers, add];
    const before = scheme === "ring" ? ringPoints(servers, vnodes) : [];
    const after = scheme === "ring" ? ringPoints(all, vnodes) : [];
    const owner = (name: string, n: number) =>
        scheme === "ring"
            ? ownerOnRing(n === servers.length ? before : after, turnOf(name))
            : hash32(name) % n;

    const keys: Key[] = names.map((name) => {
        return {
            name,
            at: turnOf(name),
            before: owner(name, servers.length),
            after: owner(name, all.length),
            slotBefore: 0,
            slotAfter: 0,
            moveRank: -1,
        };
    });

    // Before: keys fill their column in order. After: a key that stays keeps
    // its place, so the holes left by the ones that moved stay visible, and a
    // key that arrives is appended to its new column.
    const used = all.map(() => 0);
    for (const k of keys) {
        k.slotBefore = used[k.before] ?? 0;
        used[k.before] = k.slotBefore + 1;
    }
    let moved = 0;
    for (const k of keys) {
        if (k.after === k.before) {
            k.slotAfter = k.slotBefore;
        } else {
            k.slotAfter = used[k.after] ?? 0;
            used[k.after] = k.slotAfter + 1;
            k.moveRank = moved++;
        }
    }
    return {
        scheme,
        servers: all,
        vnodes,
        before,
        after,
        keys,
        moved,
        slots: Math.max(1, ...used),
    };
}
