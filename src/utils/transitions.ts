import type { TransitionDirectionalAnimations } from "astro";

/**
 * The page turn.
 *
 * fuwari fades the content down and out, then brings the next page up into
 * place. Same shape here, with the outgoing half kept short so a click feels
 * answered immediately. The keyframes live in `styles/motion.css`.
 */
const turn = {
	old: {
		name: "page-leave",
		duration: "180ms",
		easing: "cubic-bezier(0.62, 0.06, 0.32, 0.98)",
		fillMode: "both",
	},
	new: {
		name: "page-enter",
		duration: "420ms",
		easing: "cubic-bezier(0.16, 0.84, 0.44, 1)",
		fillMode: "both",
		delay: "60ms",
	},
} as const;

export const pageTurn: TransitionDirectionalAnimations = {
	forwards: turn,
	backwards: turn,
};
