/**
 * Animated figures.
 *
 * Each `.figure[data-figure]` names a module in `src/figures/kinds/`, which is
 * imported only when a page has one. The runtime owns everything a figure
 * should not have to think about: sizing the canvas for the device, reading the
 * theme, starting when the figure scrolls into view, pausing when it leaves,
 * holding on the last frame, the replay button, and reduced motion — which
 * skips straight to the final frame, since a still of the end state still says
 * what the figure says.
 *
 * `?figure-at=0.5` freezes every figure halfway through. It exists so
 * `npm run figures:shot` can capture stills; a reader never sees it.
 */

import type { BoundFigure, DefinedFigure, Frame, Palette } from "../figures/kit";
import { parseJson } from "../utils/json";

const kinds = import.meta.glob<{ default: DefinedFigure }>("../figures/kinds/*.ts");

/** Seconds of stillness between the end of a looping figure and its restart. */
const LOOP_PAUSE = 1.2;

interface Mounted {
    root: HTMLElement;
    canvas: HTMLCanvasElement;
    replay: HTMLButtonElement | null;
    kind: DefinedFigure;
    paint: BoundFigure["paint"];
    /** Undefined when the kind has a fixed height or the post set one. */
    heightFor: BoundFigure["heightFor"];
    /** Seconds into the animation. */
    time: number;
    playing: boolean;
    visible: boolean;
    last: number | null;
}

const mounted = new Set<Mounted>();
let palette: Palette | null = null;
let frameRequest: number | null = null;
let globalsWired = false;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function frozenAt(): number | null {
    const raw = new URLSearchParams(location.search).get("figure-at");
    if (raw === null) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? Math.min(1, Math.max(0, at)) : null;
}

/* — theme ———————————————————————————————————————— */

function readPalette(): Palette {
    const style = getComputedStyle(document.documentElement);
    const v = (name: string) => style.getPropertyValue(name).trim();
    return {
        paper: v("--paper-raised"),
        surface: v("--paper-sunk"),
        inkStrong: v("--ink-strong"),
        ink: v("--ink"),
        inkMuted: v("--ink-muted"),
        inkFaint: v("--ink-faint"),
        rule: v("--rule"),
        ruleFaint: v("--rule-faint"),
        marker: v("--marker"),
        markerWash: v("--marker-wash-strong"),
        warn: v("--warn"),
        danger: v("--danger"),
        sans: v("--font-sans"),
        mono: v("--font-mono"),
    };
}

/* — drawing ——————————————————————————————————————— */

function render(m: Mounted) {
    palette ??= readPalette();
    const ratio = window.devicePixelRatio || 1;
    const width = m.canvas.clientWidth;
    if (m.heightFor && width > 0) {
        // Setting the height resizes the canvas, which calls render again
        // through the ResizeObserver; the comparison stops that at one round.
        const wanted = `${String(Math.round(m.heightFor(width)))}px`;
        if (m.canvas.style.height !== wanted) m.canvas.style.height = wanted;
    }
    const height = m.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const pxW = Math.round(width * ratio);
    const pxH = Math.round(height * ratio);
    if (m.canvas.width !== pxW || m.canvas.height !== pxH) {
        m.canvas.width = pxW;
        m.canvas.height = pxH;
    }

    const ctx = m.canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const frame: Frame = {
        ctx,
        width,
        height,
        time: Math.min(m.time, m.kind.duration),
        palette,
    };
    m.paint(frame);
}

function tick(now: number) {
    frameRequest = null;
    let active = false;

    for (const m of mounted) {
        if (!m.root.isConnected) {
            mounted.delete(m);
            continue;
        }
        if (!m.playing || !m.visible) {
            m.last = null;
            continue;
        }

        const dt = m.last === null ? 0 : (now - m.last) / 1000;
        m.last = now;
        m.time += Math.min(dt, 0.1);

        const end = m.kind.duration + (m.kind.loop ? LOOP_PAUSE : 0);
        if (m.time >= end) {
            if (m.kind.loop) {
                m.time = 0;
            } else {
                m.time = m.kind.duration;
                m.playing = false;
                if (m.replay) m.replay.hidden = false;
            }
        }

        render(m);
        active ||= m.playing;
    }

    if (active) schedule();
}

function schedule() {
    frameRequest ??= requestAnimationFrame(tick);
}

function play(m: Mounted, from = 0) {
    m.time = from;
    m.playing = true;
    m.last = null;
    if (m.replay) m.replay.hidden = true;
    schedule();
}

/* — lifecycle ————————————————————————————————————— */

const observer =
    typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const m = [...mounted].find((x) => x.root === entry.target);
                    if (!m) continue;
                    m.visible = entry.isIntersecting;
                    if (m.visible && m.playing) schedule();
                }
            },
            { threshold: 0.35 },
        );

const resize =
    typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            for (const entry of entries) {
                const m = [...mounted].find((x) => x.canvas === entry.target);
                if (m) render(m);
            }
        });

async function mount(root: HTMLElement) {
    const name = root.dataset.figure ?? "";
    const load = kinds[`../figures/kinds/${name}.ts`];
    const canvas = root.querySelector("canvas");
    if (!load || !canvas) return;

    const kind = (await load()).default;
    const bound = kind.bind(parseJson(root.dataset.props ?? "{}"));

    const m: Mounted = {
        root,
        canvas,
        replay: root.querySelector<HTMLButtonElement>(".figure-replay"),
        kind,
        paint: bound.paint,
        heightFor: root.dataset.fixedHeight === undefined ? bound.heightFor : undefined,
        time: 0,
        playing: false,
        visible: observer === null,
        last: null,
    };
    mounted.add(m);
    root.classList.add("is-ready");

    m.replay?.addEventListener("click", () => {
        play(m);
    });

    // Held frames still need sizing, and reduced motion still allows an
    // explicit replay. Observe every canvas before either early return.
    observer?.observe(root);
    resize?.observe(canvas);

    const at = frozenAt();
    if (at !== null) {
        m.time = at * kind.duration;
        render(m);
        return;
    }

    if (reducedMotion()) {
        m.time = kind.duration;
        render(m);
        if (m.replay && !kind.loop) m.replay.hidden = false;
        return;
    }

    render(m);
    play(m);
}

export async function mountFigures(): Promise<void> {
    palette = null;
    const roots = document.querySelectorAll<HTMLElement>(".figure[data-figure]:not(.is-ready)");
    await Promise.all([...roots].map(mount));

    if (globalsWired) return;
    globalsWired = true;

    // Canvas text is painted in whatever face is loaded at that moment and is
    // not updated when the webfont arrives, so a held frame would keep the
    // fallback. Repaint once fonts land.
    const repaint = () => {
        for (const m of mounted) render(m);
    };
    void document.fonts.ready.then(repaint);
    document.fonts.addEventListener("loadingdone", repaint);

    // The theme toggle flips `.dark` on <html>; every figure is redrawn in the
    // new palette rather than waiting for its next frame, which may never come.
    new MutationObserver(() => {
        palette = null;
        repaint();
    }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
}
