/** Legacy kind alias. New posts compose the queue kind in a TSX component. */
import queue from "#src/figures/kinds/queue.ts";
import { checkoutPreset } from "#src/figures/presets/checkout.ts";

export default {
    ...queue,
    bind(raw) {
        return queue.bind(checkoutPreset(raw));
    },
} satisfies typeof queue;
