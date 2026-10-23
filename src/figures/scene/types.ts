/* Closed aliases keep author inputs JSON-serializable. */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import type { SymbolName } from "#src/figures/scene/symbols.ts";
import type { Tone, Rect, Point } from "#src/figures/kit.ts";

export type SceneItem<Id extends string = string> = {
    id: Id;
    label: string;
    visual?: SymbolName;
    detail?: string;
    tone?: Tone;
    parent?: NoInfer<Id>;
};

export type SceneStep<Id extends string = string> =
    { action: "focus" | "reveal"; target: Id } | { action: "transfer"; from: Id; to: Id };

export type SceneInput<Id extends string = string> = {
    title?: string;
    layout?: "flow" | "stack" | "grid" | "cycle" | "hierarchy";
    items: SceneItem<Id>[];
    motion?: "none" | "reveal" | "flow";
    steps?: SceneStep<NoInfer<Id>>[];
};

/* eslint-enable @typescript-eslint/consistent-type-definitions */

export interface Item {
    id: string;
    label: string;
    visual: SymbolName;
    detail: string;
    tone: Tone;
    parent: string | undefined;
    depth: number;
}

export interface Connection {
    from: string;
    to: string;
}

export interface SceneModel {
    title: string;
    layout: NonNullable<SceneInput["layout"]>;
    items: Item[];
    links: Connection[];
    steps: SceneStep[];
}

export interface PlacedItem extends Rect {
    item: Item;
}

export interface Route extends Connection {
    points: Point[];
}

export interface Layout {
    height: number;
    items: PlacedItem[];
    routes: Route[];
}
