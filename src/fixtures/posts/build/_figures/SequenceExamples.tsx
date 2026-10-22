/** Post-specific data and captions; all drawing uses reusable typed components. */
import { Sequence, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

const tcpExchangeData = {
    actors: [
        {
            id: "c",
            label: "Client",
            sub: "10.0.0.2",
        },
        {
            id: "s",
            label: "Server",
            sub: ":443",
        },
    ],
    messages: [
        {
            from: "c",
            to: "s",
            label: "SYN",
        },
        {
            from: "s",
            to: "c",
            label: "SYN-ACK",
        },
        {
            from: "c",
            to: "s",
            label: "ACK",
        },
        {
            from: "c",
            to: "s",
            label: "Seq 1",
            gap: 0.35,
        },
        {
            from: "c",
            to: "s",
            label: "Seq 2",
            gap: 0.35,
            lost: true,
        },
        {
            from: "c",
            to: "s",
            label: "Seq 3",
            gap: 0.35,
        },
        {
            from: "s",
            to: "c",
            label: "ACK 2",
            gap: 0.3,
        },
        {
            from: "s",
            to: "c",
            label: "ACK 2",
            gap: 0.7,
            tone: "muted",
        },
        {
            from: "c",
            to: "s",
            label: "Seq 2 retransmit",
            gap: 1.1,
            retransmits: 4,
        },
        {
            from: "s",
            to: "c",
            label: "ACK 4",
        },
    ],
    notes: [
        {
            after: 2,
            text: "Connected",
        },
        {
            after: 4,
            text: "Segment lost",
        },
        {
            after: 7,
            text: "Duplicate ACK",
        },
        {
            after: 9,
            text: "Acknowledge through 3",
        },
    ],
    timeoutLabel: "RTO",
} satisfies FigureInputs["sequence"];

export function TcpExchange(input: Partial<DiagramProps<"sequence">>) {
    return (
        <Sequence
            props={tcpExchangeData}
            caption="Losing segment two keeps acknowledgements at segment one until the retransmission timer expires."
            {...input}
        />
    );
}
