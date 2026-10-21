/** The gallery chooses examples; the plotting library only receives data. */
import FigureExamples from "../../../../components/FigureExamples";
import { statisticsExamples, type StatisticsCategory } from "./statistics-data";
export default function StatisticsExamples({ category }: {
	category: StatisticsCategory;
}) {
	return <FigureExamples examples={statisticsExamples.filter((example) => example.category === category)} />;
}
