/** The gallery chooses examples; the plotting library only receives data. */
import FigureExamples from "#src/components/FigureExamples.tsx";
import {
    statisticsExamples,
    type StatisticsCategory,
    type StatisticsExample,
} from "#src/fixtures/posts/build/_figures/statistics-data.ts";
export default function StatisticsExamples({
    category,
    kind,
}: {
    category?: StatisticsCategory;
    kind?: StatisticsExample["kind"];
}) {
    return (
        <FigureExamples
            examples={statisticsExamples.filter(
                (example) =>
                    (category === undefined || example.category === category) &&
                    (kind === undefined || example.kind === kind),
            )}
        />
    );
}
