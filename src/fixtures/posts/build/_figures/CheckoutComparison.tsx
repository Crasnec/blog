/** A post-specific story composed from the reusable queue figure. */
import { Queue } from "../../../../components/figures";
import { checkoutPreset, type CheckoutOptions } from "../../../../figures/presets/checkout";

export default function CheckoutComparison({
    registers = 3,
    customers = 12,
    slow = 0,
    seed = 4,
    caption = "One slow customer blocks a dedicated queue, while a shared queue can use the other registers.",
}: CheckoutOptions & { caption?: string }) {
    return <Queue props={checkoutPreset({ registers, customers, slow, seed })} caption={caption} />;
}
