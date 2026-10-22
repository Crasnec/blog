/** Legacy kind alias. New posts compose the queue kind in a TSX component. */
import queue from "./queue.ts";
import { checkoutPreset } from "../presets/checkout.ts";

export default {
    ...queue,
    bind(raw) {
        return queue.bind(checkoutPreset(raw));
    },
} satisfies typeof queue;
