import type { JsonObject, JsonValue } from "#src/utils/json.ts";
import { str, obj, tone, arr } from "#src/figures/kit.ts";
import { characters } from "#src/figures/scene/text.ts";
import type {
    Item,
    SceneModel,
    Connection,
    SceneStep,
    SceneInput,
} from "#src/figures/scene/types.ts";
import { isSymbolName, symbolNames } from "#src/figures/scene/symbols.ts";

function fields(p: JsonObject, names: string[], path: string): void {
    for (const key of Object.keys(p)) {
        if (!names.includes(key)) {
            throw new Error(`${path}.${key} is not supported; use ${names.join(", ")}`);
        }
    }
}

function label(value: JsonValue | undefined, path: string, max: number): string {
    const result = str(value, path);
    if (!result.trim() || characters(result).length > max) {
        throw new Error(`${path} must contain 1–${String(max)} visible characters`);
    }
    return result;
}

function identifier(value: JsonValue | undefined, path: string): string {
    const result = str(value, path);
    if (!/^[a-z][a-z0-9_-]{0,31}$/u.test(result)) {
        throw new Error(`${path} must start with a lowercase letter and use a–z, 0–9, _ or -`);
    }
    return result;
}

function choice<T extends string>(
    v: JsonValue | undefined,
    path: string,
    choices: readonly T[],
    fallback: T,
): T {
    if (v === undefined) {
        return fallback;
    }
    const found = choices.find((c) => c === v);
    if (!found) {
        throw new Error(`${path} must be one of ${choices.join(", ")}`);
    }
    return found;
}

function readItem(value: JsonValue, i: number): Item {
    const path = `props.items[${String(i)}]`;
    const p = obj(value, path);
    fields(p, ["id", "label", "visual", "detail", "tone", "parent"], path);
    const visual = p.visual === undefined ? "rounded" : str(p.visual, `${path}.visual`);
    if (!isSymbolName(visual)) {
        throw new Error(`${path}.visual is not in the symbol catalog: ${symbolNames.join(", ")}`);
    }
    return {
        id: identifier(p.id, `${path}.id`),
        label: label(p.label, `${path}.label`, 40),
        visual,
        detail: p.detail === undefined ? "" : label(p.detail, `${path}.detail`, 64),
        tone: tone(p.tone, `${path}.tone`, "ink"),
        parent: p.parent === undefined ? undefined : identifier(p.parent, `${path}.parent`),
        depth: 0,
    };
}

export function decodeScene(raw: JsonValue): SceneModel {
    const p = obj(raw, "props");
    fields(p, ["title", "layout", "items", "motion", "steps"], "props");
    const layout = choice(
        p.layout,
        "props.layout",
        ["flow", "stack", "grid", "cycle", "hierarchy"],
        "flow",
    );
    const items = arr(p.items, "props.items").map(readItem);
    if (items.length < 1 || items.length > 16) {
        throw new Error("props.items must contain 1–16 items; split larger stories into scenes");
    }
    const ids = new Map(items.map((item) => [item.id, item]));
    if (ids.size !== items.length) {
        throw new Error("props.items must have unique ids");
    }
    const find = (id: string, path: string): Item => {
        const item = ids.get(id);
        if (!item) {
            throw new Error(
                `${path} refers to missing id "${id}"; available: ${[...ids.keys()].join(", ")}`,
            );
        }
        return item;
    };
    for (const item of items) {
        if (layout !== "hierarchy" && item.parent !== undefined) {
            throw new Error(`item "${item.id}" has parent; use layout "hierarchy"`);
        }
        const visited = new Set([item.id]);
        let parent = item.parent;
        while (parent !== undefined) {
            if (visited.has(parent)) {
                throw new Error(`props.items contains a parent cycle at "${parent}"`);
            }
            visited.add(parent);
            item.depth++;
            parent = find(parent, `parent of "${item.id}"`).parent;
        }
        if (item.depth > 4) {
            throw new Error(
                "props.items hierarchy supports at most five levels; split deeper trees",
            );
        }
    }
    if (layout === "cycle" && items.length < 3) {
        throw new Error("props.layout cycle requires at least three items");
    }
    // Preorder keeps each parent's subtree contiguous even when author input is unsorted.
    const ordered: Item[] = [];
    const append = (parent: string | undefined): void => {
        for (const item of items.filter((candidate) => candidate.parent === parent)) {
            ordered.push(item);
            append(item.id);
        }
    };
    if (layout === "hierarchy") {
        append(undefined);
    } else {
        ordered.push(...items);
    }
    const links: Connection[] = [];
    ordered.forEach((item, i) => {
        if (layout === "hierarchy" && item.parent !== undefined) {
            links.push({ from: item.parent, to: item.id });
        } else if (layout === "flow" || layout === "stack" || layout === "cycle") {
            const next = ordered[i + 1] ?? (layout === "cycle" ? ordered[0] : undefined);
            if (next) {
                links.push({ from: item.id, to: next.id });
            }
        }
    });
    const motion = choice(p.motion, "props.motion", ["none", "reveal", "flow"], "flow");
    if (p.steps !== undefined && p.motion !== undefined) {
        throw new Error("props.steps and props.motion are alternatives; choose one");
    }
    const steps: SceneStep[] =
        p.steps === undefined
            ? motion === "none"
                ? []
                : motion === "flow" && links.length > 0
                    ? links.map((link) => ({ action: "transfer", ...link }))
                    : ordered.map((item) => ({ action: "reveal", target: item.id }))
            : arr(p.steps, "props.steps").map((value, i): SceneStep => {
                const path = `props.steps[${String(i)}]`;
                const s = obj(value, path);
                const action = choice(
                    s.action,
                    `${path}.action`,
                    ["focus", "reveal", "transfer"],
                    "focus",
                );
                if (s.action === undefined) {
                    throw new Error(`${path}.action is required`);
                }
                if (action === "transfer") {
                    fields(s, ["action", "from", "to"], path);
                    const from = find(identifier(s.from, `${path}.from`), `${path}.from`).id;
                    const to = find(identifier(s.to, `${path}.to`), `${path}.to`).id;
                    if (!links.some((link) => link.from === from && link.to === to)) {
                        throw new Error(
                            `${path} needs an existing forward connection from "${from}" to "${to}"`,
                        );
                    }
                    return { action, from, to };
                }
                fields(s, ["action", "target"], path);
                return {
                    action,
                    target: find(identifier(s.target, `${path}.target`), `${path}.target`).id,
                };
            });
    if (steps.length > 16) {
        throw new Error("props.steps supports at most 16 steps; split longer animations");
    }
    return {
        title: p.title === undefined ? "" : label(p.title, "props.title", 64),
        layout,
        items: ordered,
        links,
        steps,
    };
}

/** Also constrains references to the supplied IDs when a post is authored in TypeScript. */
export function defineScene<const Id extends string>(input: SceneInput<Id>): SceneInput<Id> {
    decodeScene(input);
    return input;
}
