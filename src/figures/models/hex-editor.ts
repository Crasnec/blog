/** A byte buffer and its edit history, independent of a canvas or DOM. */
export type HexEditorAction =
	| { op: "select"; index: number; label?: string }
	| { op: "write"; index: number; value: number; label?: string };

export interface HexEditorSnapshot {
	bytes: number[];
	selected: number;
}

export interface HexEditorStep {
	action: HexEditorAction;
	before: HexEditorSnapshot;
	after: HexEditorSnapshot;
}

/** Writes replace one byte; selecting never changes the buffer or its length. */
export function traceHexEditor(bytes: readonly number[], actions: readonly HexEditorAction[], selected = 0): HexEditorStep[] {
	let state: HexEditorSnapshot = { bytes: [...bytes], selected };
	return actions.map((action) => {
		const next = [...state.bytes];
		if (action.op === "write") next[action.index] = action.value;
		const after = { bytes: next, selected: action.index };
		const step = { action: { ...action }, before: state, after };
		state = after;
		return step;
	});
}

export const hexByte = (byte: number): string => byte.toString(16).toUpperCase().padStart(2, "0");

/** This is an ASCII column, not a UTF-8 or other multibyte text decoder. */
export const asciiByte = (byte: number): string => byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "·";
