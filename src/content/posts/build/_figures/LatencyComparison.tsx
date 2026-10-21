/** One data set, two reusable statistical views. No figure kind is added. */
import { ECDF, Boxplot } from "../../../../components/figures";
import { lognormal, random } from "../../../../figures/kit";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Keep a closed serializable shape assignable to JsonObject.
type Group = { label: string; values: number[] };
const rand = random(35);
const defaultGroups: Group[] = [
	{ label: "Server A", values: Array.from({ length: 48 }, () => Math.round(lognormal(rand, 130, 0.25))) },
	{ label: "Server B", values: [...Array.from({ length: 44 }, () => Math.round(lognormal(rand, 95, 0.3))), 430, 520, 610, 900] },
];

export default function LatencyComparison({ groups = defaultGroups, unit = "ms" }: { groups?: Group[]; unit?: string }) {
	return (
		<>
			<ECDF props={{ groups, unit }} caption="Compare the fraction at or below each value. Both views use the same samples." />
			<Boxplot props={{ groups, unit }} caption="Read the median, central half and outlying observations of those same samples." />
		</>
	);
}
