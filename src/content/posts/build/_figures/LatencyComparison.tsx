/** One data set, two reusable statistical views. No figure kind is added. */
import { ECDF, Boxplot } from "../../../../components/figures";
import { lognormal, random } from "../../../../figures/kit";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Keep a closed serializable shape assignable to JsonObject.
type Group = { label: string; values: number[] };
const rand = random(35);
const defaultGroups: Group[] = [
	{ label: "서버 A", values: Array.from({ length: 48 }, () => Math.round(lognormal(rand, 130, 0.25))) },
	{ label: "서버 B", values: [...Array.from({ length: 44 }, () => Math.round(lognormal(rand, 95, 0.3))), 430, 520, 610, 900] },
];

export default function LatencyComparison({ groups = defaultGroups, unit = "ms" }: { groups?: Group[]; unit?: string }) {
	return (
		<>
			<ECDF props={{ groups, unit }} caption="각 값 이하에 들어오는 관측 비율을 비교한다. 두 도표는 같은 표본을 사용한다." />
			<Boxplot props={{ groups, unit }} caption="같은 표본의 중앙값·중앙 50%와 바깥 관측값을 함께 확인한다." />
		</>
	);
}
