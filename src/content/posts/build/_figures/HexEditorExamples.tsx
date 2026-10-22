/** Post-specific buffers and edit scripts; the library owns the rendering. */
import { HexEditor, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const greeting = {
	title: "greeting.bin",
	baseOffset: 0x1000,
	bytes: [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x62, 0x79, 0x74, 0x65, 0x73, 0x21, 0x0a, 0x00, 0xff],
	actions: [
		{ op: "select", index: 0, label: "0x48 is the ASCII character H" },
		{ op: "write", index: 0, value: 0x68, label: "Replace H with h at the same address" },
		{ op: "select", index: 13, label: "0x0A is a line feed, shown as a dot" },
		{ op: "write", index: 13, value: 0x2e, label: "Replace the line feed with a printable full stop" },
	],
} satisfies FigureInputs["hex-editor"];

const flags = {
	title: "packet header",
	bytes: [0x42, 0x4c, 0x4f, 0x47, 0x01, 0x00, 0x20, 0x7e, 0x7f, 0x80, 0xfe, 0xff],
	selected: 4,
	actions: [
		{ op: "write", index: 4, value: 0x03, label: "Set bit 1: 00000001 becomes 00000011" },
		{ op: "select", index: 8, label: "0x7F is outside printable ASCII" },
		{ op: "write", index: 8, value: 0x41, label: "0x41 becomes A in the ASCII column" },
	],
} satisfies FigureInputs["hex-editor"];

export function GreetingBytes(input: Partial<DiagramProps<"hex-editor">>) {
	return <HexEditor props={greeting} caption="Hex 48 changes to 68 as H changes to h. Both columns read the same byte; replacing a byte keeps all sixteen addresses in place." {...input} />;
}

export function HeaderBytes(input: Partial<DiagramProps<"hex-editor">>) {
	return <HexEditor props={flags} caption="A byte can change while its ASCII cell remains a dot: 01 and 03 are both non-printable. The later replacement 7F → 41 makes the letter A appear." {...input} />;
}
