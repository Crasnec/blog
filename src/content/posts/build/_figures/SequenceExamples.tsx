/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Sequence, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const tcpExchangeData = {
	actors: [
		{
			id: "c", label: "클라이언트", sub: "10.0.0.2"
		},
		{
			id: "s", label: "서버", sub: ":443"
		},
	],
	messages: [
		{
			from: "c", to: "s", label: "SYN"
		},
		{
			from: "s", to: "c", label: "SYN-ACK"
		},
		{
			from: "c", to: "s", label: "ACK"
		},
		{
			from: "c", to: "s", label: "Seq 1", gap: 0.35
		},
		{
			from: "c", to: "s", label: "Seq 2", gap: 0.35, lost: true
		},
		{
			from: "c", to: "s", label: "Seq 3", gap: 0.35
		},
		{
			from: "s", to: "c", label: "ACK 2", gap: 0.3
		},
		{
			from: "s", to: "c", label: "ACK 2", gap: 0.7, tone: "muted"
		},
		{
			from: "c", to: "s", label: "Seq 2 재전송", gap: 1.1, retransmits: 4
		},
		{
			from: "s", to: "c", label: "ACK 4"
		},
	],
	notes: [
		{
			after: 2, text: "연결 수립"
		},
		{
			after: 4, text: "세그먼트 손실"
		},
		{
			after: 7, text: "같은 확인 반복"
		},
		{
			after: 9, text: "3번까지 한꺼번에 확인"
		},
	],
	timeoutLabel: "RTO"
} satisfies FigureInputs["sequence"];

export function TcpExchange(input: Partial<DiagramProps<"sequence">>) {
	return <Sequence props={tcpExchangeData} caption="두 번째 세그먼트가 사라지면, 세 번째가 도착해도 서버는 1번까지만 확인한다. 클라이언트는 재전송 타이머가 끝나야 다시 보낸다." {...input} />;
}
