/** Post-specific data and captions; all drawing uses reusable typed components. */
import { HashRing, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const sharedServers: FigureInputs["hash-ring"]["servers"] = ["A", "B", "C"];

const keyNames = Array.from({ length: 24 }, (_, i) => `key-${String(i)}`);

const moduloPlacementData = {
	scheme: "modulo",
	servers: sharedServers,
	add: "D",
	keys: keyNames
} satisfies FigureInputs["hash-ring"];

const virtualNodeRingData = {
	scheme: "ring",
	servers: sharedServers,
	add: "D",
	vnodes: 8,
	keys: keyNames
} satisfies FigureInputs["hash-ring"];

const singleNodeRingData = {
	scheme: "ring",
	servers: sharedServers,
	add: "D",
	vnodes: 1,
	keys: keyNames
} satisfies FigureInputs["hash-ring"];

export function ModuloPlacement(input: Partial<DiagramProps<"hash-ring">>) {
	return <HashRing props={moduloPlacementData} caption="서버 수가 바뀌자 대부분의 키가 다른 서버로 옮겨 간다. D가 원래 맡아야 할 몫은 6개뿐이다." {...input} />;
}

export function VirtualNodeRing(input: Partial<DiagramProps<"hash-ring">>) {
	return <HashRing props={virtualNodeRingData} caption="D의 점들이 링 곳곳에서 작은 구간을 가져간다. 옮겨 가는 키는 D의 몫과 거의 같다." {...input} />;
}

export function SingleNodeRing(input: Partial<DiagramProps<"hash-ring">>) {
	return <HashRing props={singleNodeRingData} caption="점이 서버마다 하나면 D가 가져가는 구간이 해시 값에 달려 있다. 여기서는 키 하나뿐이다." {...input} />;
}
