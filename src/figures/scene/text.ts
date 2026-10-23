const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function characters(value: string): string[] {
    return Array.from(graphemes.segment(value), (part) => part.segment);
}
