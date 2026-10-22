/** Reusable deterministic model, independent of canvas rendering and post data. */
export type Operation = "bst-insert" | "bst-search" | "heap-insert";

/** One node as laid out after a step: position as fractions, plus links. */
export interface Placed {
    value: number;
    parent: number | undefined;
    depth: number;
    /** 0–1 across the board. */
    x: number;
}

/** The whole tree after a step, by node id (the order nodes were created). */
export type Snapshot = Map<number, Placed>;

export interface Step {
    kind: "compare" | "place" | "swap" | "found" | "missing";
    start: number;
    end: number;
    /** The tree once this step is done. */
    after: Snapshot;
    /** Nodes this step is about: the compared node, the swapped pair, the new node. */
    focus: number[];
    /** Nodes on the path taken so far, root first; drawn as heavier edges. */
    path: number[];
    /** Written beside the focused node, e.g. "42 < 50". */
    note: string | undefined;
    /** A node that appears in this step and grows in. */
    born: number | undefined;
    /** Comparisons made up to and including this step. */
    comparisons: number;
}

export interface Trace {
    initial: Snapshot;
    steps: Step[];
    /** Deepest level reached anywhere in the trace, so the scale never jumps. */
    maxDepth: number;
    /** Comparisons made by the last insertion, or by the search. */
    lastComparisons: number;
    result: string | undefined;
}

/** A pending step before it is timed: the same fields without start and end. */
export type Draft = Omit<Step, "start" | "end">;

export interface BstNode {
    value: number;
    left: number | undefined;
    right: number | undefined;
    parent: number | undefined;
}

/** Lays a BST out by in-order rank across, depth down. */
function bstSnapshot(nodes: BstNode[], root: number | undefined): Snapshot {
    const order: { id: number; depth: number }[] = [];
    const walk = (id: number | undefined, depth: number) => {
        if (id === undefined) return;
        const n = nodes[id];
        if (!n) return;
        walk(n.left, depth + 1);
        order.push({ id, depth });
        walk(n.right, depth + 1);
    };
    walk(root, 0);
    const snap: Snapshot = new Map();
    for (const [rank, { id, depth }] of order.entries()) {
        const n = nodes[id];
        if (!n) continue;
        snap.set(id, { value: n.value, parent: n.parent, depth, x: (rank + 0.5) / order.length });
    }
    return snap;
}

/** Builds a BST by plain insertion, recording every comparison. */
function bstInsertAll(values: number[], record: boolean) {
    const nodes: BstNode[] = [];
    let root: number | undefined;
    const drafts: Draft[] = [];
    let comparisons = 0;
    let last = 0;

    for (const value of values) {
        const id = nodes.length;
        const path: number[] = [];
        let parent: number | undefined;
        let at = root;
        let made = 0;
        while (at !== undefined) {
            const n = nodes[at];
            if (!n) break;
            path.push(at);
            comparisons++;
            made++;
            const goLeft = value < n.value;
            if (record) {
                drafts.push({
                    kind: "compare",
                    after: bstSnapshot(nodes, root),
                    focus: [at],
                    path: [...path],
                    note: `${String(value)} ${goLeft ? "<" : ">"} ${String(n.value)}`,
                    born: undefined,
                    comparisons,
                });
            }
            parent = at;
            at = goLeft ? n.left : n.right;
        }
        nodes.push({ value, left: undefined, right: undefined, parent });
        const p = parent === undefined ? undefined : nodes[parent];
        if (!p) root = id;
        else if (value < p.value) p.left = id;
        else p.right = id;
        last = made;
        if (record) {
            drafts.push({
                kind: "place",
                after: bstSnapshot(nodes, root),
                focus: [id],
                path: [...path, id],
                note: undefined,
                born: id,
                comparisons,
            });
        }
    }
    return { nodes, root, drafts, last };
}

/** Lays a heap out by slot: level by level, evenly within each level. */
function heapSnapshot(slots: number[], values: number[]): Snapshot {
    const snap: Snapshot = new Map();
    for (const [slot, id] of slots.entries()) {
        const depth = Math.floor(Math.log2(slot + 1));
        const first = 2 ** depth - 1;
        snap.set(id, {
            value: values[id] ?? 0,
            parent: slot === 0 ? undefined : slots[Math.floor((slot - 1) / 2)],
            depth,
            x: (slot - first + 0.5) / 2 ** depth,
        });
    }
    return snap;
}

export function traceTree(
    operation: Operation,
    values: number[],
    target: number | undefined,
): Trace {
    if (operation === "bst-insert") {
        const built = bstInsertAll(values, true);
        return finish(new Map(), built.drafts, built.last, undefined);
    }

    if (operation === "bst-search") {
        const built = bstInsertAll(values, false);
        const initial = bstSnapshot(built.nodes, built.root);
        const drafts: Draft[] = [];
        const path: number[] = [];
        let at = built.root;
        let comparisons = 0;
        let found: number | undefined;
        while (at !== undefined) {
            const n = built.nodes[at];
            if (!n) break;
            path.push(at);
            comparisons++;
            const sign = target === n.value ? "=" : (target ?? 0) < n.value ? "<" : ">";
            drafts.push({
                kind: "compare",
                after: initial,
                focus: [at],
                path: [...path],
                note: `${String(target)} ${sign} ${String(n.value)}`,
                born: undefined,
                comparisons,
            });
            if (sign === "=") {
                found = at;
                break;
            }
            at = sign === "<" ? n.left : n.right;
        }
        const last = path[path.length - 1];
        drafts.push({
            kind: found === undefined ? "missing" : "found",
            after: initial,
            focus: last === undefined ? [] : [last],
            path: [...path],
            note: found === undefined ? `${String(target)} 없음` : undefined,
            born: undefined,
            comparisons,
        });
        return finish(initial, drafts, comparisons, found === undefined ? "없음" : "찾음");
    }

    // Max-heap: append at the next slot, then swap upward while the parent is smaller.
    const slots: number[] = [];
    const drafts: Draft[] = [];
    let comparisons = 0;
    let last = 0;
    for (const [id] of values.entries()) {
        let slot = slots.length;
        slots.push(id);
        drafts.push({
            kind: "place",
            after: heapSnapshot(slots, values),
            focus: [id],
            path: [id],
            note: undefined,
            born: id,
            comparisons,
        });
        let made = 0;
        while (slot > 0) {
            const up = Math.floor((slot - 1) / 2);
            const parent = slots[up] ?? 0;
            const a = values[id] ?? 0;
            const b = values[parent] ?? 0;
            comparisons++;
            made++;
            const swap = a > b;
            drafts.push({
                kind: "compare",
                after: heapSnapshot(slots, values),
                focus: [id, parent],
                path: [parent, id],
                note: `${String(a)} ${swap ? ">" : "≤"} ${String(b)}`,
                born: undefined,
                comparisons,
            });
            if (!swap) break;
            slots[up] = id;
            slots[slot] = parent;
            slot = up;
            drafts.push({
                kind: "swap",
                after: heapSnapshot(slots, values),
                focus: [id, parent],
                path: [id, parent],
                note: undefined,
                born: undefined,
                comparisons,
            });
        }
        last = made;
    }
    return finish(new Map(), drafts, last, undefined);
}

/** Leaves the steps untimed; `time` spreads them once the step length is known. */
function finish(
    initial: Snapshot,
    drafts: Draft[],
    last: number,
    result: string | undefined,
): Trace {
    let maxDepth = 0;
    for (const snap of [initial, ...drafts.map((d) => d.after)]) {
        for (const n of snap.values()) maxDepth = Math.max(maxDepth, n.depth);
    }
    return {
        initial,
        steps: drafts.map((d) => ({ ...d, start: 0, end: 0 })),
        maxDepth,
        lastComparisons: last,
        result,
    };
}

/** Gives every step its start and end, `step` seconds per comparison. */
