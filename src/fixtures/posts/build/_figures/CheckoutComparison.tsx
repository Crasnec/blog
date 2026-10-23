/** A post-specific story composed from the reusable queue figure. */
import { Queue } from "#src/components/figures/index.tsx";
import { checkoutPreset, type CheckoutOptions } from "#src/figures/presets/checkout.ts";

export default function CheckoutComparison({
    registers = 3,
    customers = 12,
    slow = 0,
    seed = 4,
    caption = "One slow customer blocks a dedicated queue, while a shared queue can use the other registers.",
}: CheckoutOptions & { caption?: string }) {
    return <Queue props={checkoutPreset({ registers, customers, slow, seed })} caption={caption} />;
}
