/**
 * hex-editor — two views of one author-supplied byte buffer.
 *
 * bytes: 1–64 integers in 0–255. actions: 0–12 select/write operations with
 * zero-based indices. A write replaces one byte and selects its index.
 * baseOffset: optional unsigned 32-bit address of bytes[0]. selected: initial
 * zero-based index (default 0). title: optional, at most 48 characters.
 * Every frame is derived from an immutable trace; hex and ASCII commit together.
 */
import {
    arr,
    box,
    clamp,
    defineFigure,
    ease,
    fittedText,
    maybe,
    num,
    obj,
    progress,
    str,
    text,
    withAlpha,
} from "../kit.ts";
import {
    asciiByte,
    hexByte,
    traceHexEditor,
    type HexEditorAction,
    type HexEditorSnapshot,
    type HexEditorStep,
} from "../models/hex-editor.ts";
import type { JsonObject } from "../../utils/json.ts";

const TIMES = { appear: 0.5, start: 0.8, maxStep: 1.25, commit: 0.55, tail: 1.3 } as const;
const DURATION = 10;
const TOP = 78;
const ROW_HEIGHT = 30;
const FOOTER = 122;

interface Props {
    initial: HexEditorSnapshot;
    steps: HexEditorStep[];
    baseOffset: number;
    title: string;
    step: number;
}

const columnsFor = (width: number): number => (width < 520 ? 4 : width < 760 ? 8 : 16);
const address = (value: number): string => value.toString(16).toUpperCase().padStart(8, "0");

function keys(value: JsonObject, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(value))
        if (!allowed.includes(key)) throw new Error(`${path}.${key} is not a supported field`);
}

function integer(value: number, min: number, max: number, path: string): number {
    if (!Number.isInteger(value) || value < min || value > max)
        throw new Error(`${path} must be a whole number from ${String(min)} to ${String(max)}`);
    return value;
}

export default defineFigure<Props>({
    duration: DURATION,
    height: 320,
    heightFor: (width, props) =>
        TOP + Math.ceil(props.initial.bytes.length / columnsFor(width)) * ROW_HEIGHT + FOOTER,
    decode(raw) {
        const p = obj(raw, "props");
        keys(p, ["bytes", "actions", "baseOffset", "selected", "title"], "props");
        const bytes = arr(p.bytes, "props.bytes").map((value, i) =>
            integer(num(value, `props.bytes[${String(i)}]`), 0, 255, `props.bytes[${String(i)}]`),
        );
        if (bytes.length < 1 || bytes.length > 64)
            throw new Error("props.bytes must contain 1 to 64 bytes");
        const baseOffset = integer(
            maybe(p.baseOffset, "props.baseOffset", num) ?? 0,
            0,
            0xffffffff - bytes.length + 1,
            "props.baseOffset",
        );
        const selected = integer(
            maybe(p.selected, "props.selected", num) ?? 0,
            0,
            bytes.length - 1,
            "props.selected",
        );
        const title = maybe(p.title, "props.title", str) ?? "Byte buffer";
        if (title.length > 48) throw new Error("props.title must be at most 48 characters");
        const rawActions = p.actions === undefined ? [] : arr(p.actions, "props.actions");
        if (rawActions.length > 12)
            throw new Error("props.actions must contain at most 12 actions");
        const actions: HexEditorAction[] = rawActions.map((rawAction, i) => {
            const path = `props.actions[${String(i)}]`;
            const action = obj(rawAction, path);
            const op = str(action.op, `${path}.op`);
            if (op !== "select" && op !== "write")
                throw new Error(`${path}.op must be "select" or "write"`);
            keys(
                action,
                op === "write" ? ["op", "index", "value", "label"] : ["op", "index", "label"],
                path,
            );
            const index = integer(
                num(action.index, `${path}.index`),
                0,
                bytes.length - 1,
                `${path}.index`,
            );
            const label = maybe(action.label, `${path}.label`, str);
            if (label !== undefined && label.length > 80)
                throw new Error(`${path}.label must be at most 80 characters`);
            const description = label === undefined ? {} : { label };
            return op === "write"
                ? {
                    op,
                    index,
                    value: integer(num(action.value, `${path}.value`), 0, 255, `${path}.value`),
                    ...description,
                }
                : { op, index, ...description };
        });
        return {
            initial: { bytes, selected },
            baseOffset,
            title,
            steps: traceHexEditor(bytes, actions, selected),
            step:
                actions.length === 0
                    ? TIMES.maxStep
                    : Math.min(
                        TIMES.maxStep,
                        (DURATION - TIMES.start - TIMES.tail) / actions.length,
                    ),
        };
    },
    draw(frame, props) {
        const { ctx, width, time, palette } = frame;
        const { initial, steps, step, baseOffset } = props;
        const elapsed = Math.max(0, (time - TIMES.start) / step);
        const done = time >= TIMES.start && elapsed >= steps.length;
        const k = clamp(Math.floor(elapsed), 0, steps.length);
        const active = time < TIMES.start || done ? undefined : steps[k];
        const fraction = active ? elapsed - k : 0;
        const committed = fraction >= TIMES.commit;
        const settled = k === 0 ? initial : (steps[k - 1]?.after ?? initial);
        const current = active
            ? {
                bytes: committed ? active.after.bytes : active.before.bytes,
                selected: active.action.index,
            }
            : settled;
        const completed = k + (active && committed ? 1 : 0);
        const columns = columnsFor(width);
        const rows = Math.ceil(initial.bytes.length / columns);
        const offsetWidth = 68;
        const gap = width < 520 ? 10 : 18;
        const asciiWidth = columns * (width < 520 ? 14 : 15);
        const hexX = offsetWidth + gap;
        const hexWidth = width - hexX - gap - asciiWidth;
        const hexCell = hexWidth / columns;
        const asciiX = hexX + hexWidth + gap;
        const asciiCell = asciiWidth / columns;
        const selectedValue = current.bytes[current.selected] ?? 0;
        const changed = current.bytes.reduce(
            (count, byte, i) => count + (byte === initial.bytes[i] ? 0 : 1),
            0,
        );
        const footerY = TOP + rows * ROW_HEIGHT + 18;

        withAlpha(ctx, ease.out(progress(time, 0, TIMES.appear)), () => {
            // 1. Stable structure and column offsets.
            fittedText(frame, props.title, 0, 16, width - 85, palette.inkStrong);
            text(frame, `${String(current.bytes.length)} bytes`, width, 16, {
                align: "right",
                mono: true,
                size: 11,
                color: palette.inkMuted,
            });
            text(frame, "Offset", 0, 42, { size: 11, color: palette.inkMuted });
            text(frame, "Hex", hexX, 42, { size: 11, color: palette.inkMuted });
            text(frame, "ASCII", asciiX, 42, { size: 11, color: palette.inkMuted });
            for (let col = 0; col < columns; col++)
                text(frame, hexByte(col), hexX + (col + 0.5) * hexCell, 64, {
                    mono: true,
                    align: "center",
                    size: 11,
                    color: palette.inkFaint,
                });
            ctx.strokeStyle = palette.rule;
            ctx.beginPath();
            ctx.moveTo(0, TOP - 7);
            ctx.lineTo(width, TOP - 7);
            ctx.stroke();

            // 2. One byte array supplies both representations, including selection.
            for (let row = 0; row < rows; row++) {
                const y = TOP + row * ROW_HEIGHT;
                text(frame, address(baseOffset + row * columns), 0, y + 18, {
                    mono: true,
                    size: 11,
                    color: palette.inkFaint,
                });
                for (let col = 0; col < columns; col++) {
                    const index = row * columns + col;
                    const byte = current.bytes[index];
                    if (byte === undefined) continue;
                    const selected = index === current.selected;
                    const modified = byte !== initial.bytes[index];
                    const hexLeft = hexX + col * hexCell;
                    const asciiLeft = asciiX + col * asciiCell;
                    if (selected) {
                        box(
                            ctx,
                            hexLeft + 1,
                            y,
                            hexCell - 2,
                            25,
                            3,
                            palette.markerWash,
                            palette.marker,
                            1.5,
                        );
                        box(
                            ctx,
                            asciiLeft,
                            y,
                            asciiCell,
                            25,
                            3,
                            palette.markerWash,
                            palette.marker,
                            1.5,
                        );
                    }
                    const color = selected || modified ? palette.marker : palette.inkStrong;
                    text(frame, hexByte(byte), hexLeft + hexCell / 2, y + 18, {
                        mono: true,
                        align: "center",
                        size: 12,
                        weight: selected ? 700 : 400,
                        color,
                    });
                    text(frame, asciiByte(byte), asciiLeft + asciiCell / 2, y + 18, {
                        mono: true,
                        align: "center",
                        size: 12,
                        weight: selected ? 700 : 400,
                        color: byte < 0x20 || byte > 0x7e ? palette.inkFaint : color,
                    });
                    if (modified) {
                        ctx.fillStyle = palette.marker;
                        ctx.fillRect(hexLeft + hexCell / 2 - 4, y + 26, 8, 2);
                    }
                }
            }

            // 3. The inspector reports actual data, never a separately animated value.
            ctx.strokeStyle = palette.rule;
            ctx.beginPath();
            ctx.moveTo(0, footerY - 7);
            ctx.lineTo(width, footerY - 7);
            ctx.stroke();
            text(frame, `Selected 0x${address(baseOffset + current.selected)}`, 0, footerY + 12, {
                size: 12,
                mono: true,
                color: palette.inkStrong,
            });
            const ascii =
                selectedValue === 0x20
                    ? "space"
                    : selectedValue >= 0x21 && selectedValue <= 0x7e
                        ? asciiByte(selectedValue)
                        : "non-printable";
            text(
                frame,
                `0x${hexByte(selectedValue)} · ${String(selectedValue)} · ${ascii}`,
                0,
                footerY + 35,
                { mono: true, size: 11, color: palette.inkMuted },
            );
            text(frame, selectedValue.toString(2).padStart(8, "0"), width, footerY + 12, {
                mono: true,
                align: "right",
                size: 11,
                color: palette.inkMuted,
            });
            const actionText = active
                ? active.action.op === "write"
                    ? `Write 0x${hexByte(active.before.bytes[active.action.index] ?? 0)} → 0x${hexByte(active.action.value)}${committed ? " · saved" : ""}`
                    : "Select byte"
                : done
                    ? `${String(changed)} changed · ${String(completed)} actions`
                    : "Select a byte to inspect it";
            fittedText(
                frame,
                active?.action.label ?? actionText,
                0,
                footerY + 61,
                width,
                palette.marker,
            );
            if (active?.action.label)
                fittedText(frame, actionText, 0, footerY + 83, width, palette.inkMuted);
        });
    },
});
