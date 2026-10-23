/** Reusable example list; its content stays with the post, outside the kinds. */
import Figure, { type FigureProps } from "#src/components/Figure.tsx";

export default function FigureExamples({
    examples,
    idPrefix = "",
}: {
    examples: readonly (FigureProps & { title: string; id?: string })[];
    idPrefix?: string;
}) {
    const counts = new Map<string, number>();
    for (const example of examples) {
        counts.set(example.kind, (counts.get(example.kind) ?? 0) + 1);
    }
    return examples.map((example, index) => {
        const repeated = (counts.get(example.kind) ?? 0) > 1;
        const id =
            idPrefix +
            (example.id ?? (repeated ? `${example.kind}-${String(index + 1)}` : example.kind));
        return (
            <section key={id}>
                <h3 id={id}>{example.title}</h3>
                <Figure
                    {...example}
                    label={example.label ?? `${example.title}. ${example.caption ?? ""}`}
                />
            </section>
        );
    });
}
