/** A bespoke SVG diagram lives with the post and needs no global kind. */
import SvgFigure from "../../../../components/SvgFigure";
import { normalCdf } from "../../../../figures/statistics/math";

export default function NormalCoverage({ deviations = 1.96 }: { deviations?: number }) {
    if (!Number.isFinite(deviations) || deviations < 0.1 || deviations > 3.5)
        throw new Error("NormalCoverage deviations must be from 0.1 to 3.5");
    const coverage = ((2 * normalCdf(deviations) - 1) * 100).toFixed(1);
    const x = (z: number) => 30 + ((z + 4) / 8) * 340;
    const y = (z: number) => 180 - (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * 300;
    const path = (low: number, high: number) =>
        Array.from({ length: 121 }, (_, i) => {
            const z = low + ((high - low) * i) / 120;
            return `${i === 0 ? "M" : "L"}${x(z).toFixed(2)},${y(z).toFixed(2)}`;
        }).join(" ");
    const label = `A standard normal variable falls within ${String(deviations)} standard deviations of its mean with probability ${coverage}%.`;
    const labelX = (z: number) =>
        z === 0 ? x(0) : z < 0 ? Math.min(x(z), x(0) - 72) : Math.max(x(z), x(0) + 72);
    return (
        <SvgFigure
            name="normal-coverage"
            label={label}
            caption={label}
            width={400}
            height={230}
            maxWidth={540}
        >
            <text x={200} y={27} textAnchor="middle" fontSize={18} fill="var(--ink-strong)">
                Central {coverage}%
            </text>
            <path
                d={`${path(-deviations, deviations)} L${String(x(deviations))},180 L${String(x(-deviations))},180 Z`}
                fill="var(--marker)"
                fillOpacity={0.2}
            />
            <path d={path(-4, 4)} fill="none" stroke="var(--ink-muted)" strokeWidth={2} />
            <line x1={30} y1={180} x2={370} y2={180} stroke="var(--rule)" />
            {[-deviations, 0, deviations].map((z) => (
                <g key={z}>
                    <line
                        x1={x(z)}
                        y1={y(z)}
                        x2={x(z)}
                        y2={185}
                        stroke={z === 0 ? "var(--rule)" : "var(--marker)"}
                        strokeDasharray="3 3"
                    />
                    <line x1={x(z)} y1={185} x2={labelX(z)} y2={191} stroke="var(--rule)" />
                    <text
                        x={labelX(z)}
                        y={209}
                        textAnchor="middle"
                        fontSize={18}
                        fill="var(--ink-muted)"
                    >
                        {z === 0 ? "Mean" : `${z > 0 ? "+" : ""}${String(Number(z.toFixed(2)))}σ`}
                    </text>
                </g>
            ))}
        </SvgFigure>
    );
}
