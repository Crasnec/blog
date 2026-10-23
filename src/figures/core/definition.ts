import type { JsonValue } from "#src/utils/json.ts";

/** Colours and faces, read from the active theme's tokens on every redraw. */
export interface Palette {
    paper: string;
    surface: string;
    inkStrong: string;
    ink: string;
    inkMuted: string;
    inkFaint: string;
    rule: string;
    ruleFaint: string;
    /** The site's one accent. Use it for the thing the reader should watch. */
    marker: string;
    markerWash: string;
    warn: string;
    danger: string;
    sans: string;
    mono: string;
}

export interface Frame {
    ctx: CanvasRenderingContext2D;
    /** CSS pixels. The canvas is already scaled for the device. */
    width: number;
    height: number;
    /** Seconds since the figure started, from 0 to `duration`. */
    time: number;
    palette: Palette;
}

export interface FigureKind<P> {
    /** Seconds the animation runs before it holds on its last frame. */
    duration: number;
    /** Start over after a pause instead of holding. Use for steady-state motion. */
    loop?: boolean;
    /** Canvas height in CSS pixels unless the post overrides it. */
    height?: number;
    /**
     * Canvas height for a given width, when the right height depends on the
     * width — a grid with square cells, a ring that should stay round. Called
     * whenever the figure is resized. `height` is still used before the first
     * measurement and when the post sets a height itself.
     */
    heightFor?: (width: number, props: P) => number;
    /**
     * Turns the post's `props` into the figure's own type, or throws naming the
     * field that is wrong. Runs at build time, so a typo fails the build.
     */
    decode: (raw: JsonValue) => P;
    /** Optional static source data, rendered as HTML alongside the canvas. */
    table?: (props: P) => FigureTable;
    draw: (frame: Frame, props: P) => void;
}

export interface FigureTable {
    columns: string[];
    rows: (string | number)[][];
    unit: string;
}

/** A figure bound to one post's props: what the runtime holds per canvas. */
export interface BoundFigure {
    paint: (frame: Frame) => void;
    heightFor: ((width: number) => number) | undefined;
    table?: FigureTable | undefined;
}

/**
 * A figure with its props type erased, which is what the runtime and the
 * `<Figure>` component hold: they never need to know what `P` was, only how to
 * check a post's props and get back something that draws.
 */
export interface DefinedFigure {
    duration: number;
    loop: boolean;
    height: number;
    /** Decodes `raw` (throwing if it is wrong) and returns the bound figure. */
    bind: (raw: JsonValue) => BoundFigure;
}

export function defineFigure<P>(kind: FigureKind<P>): DefinedFigure {
    return {
        duration: kind.duration,
        loop: kind.loop ?? false,
        height: kind.height ?? 280,
        bind(raw) {
            const props = kind.decode(raw);
            const { heightFor } = kind;
            return {
                table: kind.table?.(props),
                paint: (frame) => {
                    kind.draw(frame, props);
                },
                heightFor: heightFor && ((width) => heightFor(width, props)),
            };
        },
    };
}
