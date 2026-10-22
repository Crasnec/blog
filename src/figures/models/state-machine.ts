/** Reusable deterministic model, independent of canvas rendering and post data. */
export type EventTone = "ok" | "fail" | "timer";
export const EVENT_TONES: readonly EventTone[] = ["ok", "fail", "timer"];

export interface State {
    id: string;
    label: string;
    x: number;
    y: number;
}

export interface EventKind {
    id: string;
    label: string;
    tone: EventTone;
}

export interface Transition {
    from: number;
    to: number;
    on: string;
    /** Fires on the `count`-th matching event in a row while in `from`. */
    count: number;
    label: string;
    bend: number | undefined;
}

/** What one input did. */
export interface Step {
    at: number;
    event: string;
    /** Index into `transitions` if it fired one. */
    fired: number | undefined;
    /** The state the machine was in when the input arrived. */
    state: number;
    /** For every transition with a count, its counter after this input. */
    counters: number[];
}

/*
 * The rules: in the current state, find the one transition whose `on` matches
 * the input. If it has a count, bump its counter and fire only when the
 * counter reaches it; any other input resets that counter, and entering a
 * state (including through a loop back into the same one) resets them all.
 * An input that matches nothing is ignored, which is itself worth showing.
 */
export function runMachine(
    start: number,
    transitions: Transition[],
    inputs: { at: number; event: string }[],
): Step[] {
    let state = start;
    let counters = transitions.map(() => 0);
    const steps: Step[] = [];

    for (const input of inputs) {
        const at = state;
        const index = transitions.findIndex((t) => t.from === state && t.on === input.event);
        const next = counters.map((c, i) => {
            const t = transitions[i];
            if (t?.from !== state) return 0;
            return t.on === input.event ? c + 1 : 0;
        });

        let fired: number | undefined;
        const t = transitions[index];
        if (t && (next[index] ?? 0) >= t.count) {
            fired = index;
            state = t.to;
        }
        // Firing enters a state, which starts every counter afresh; the step
        // still records n/n so the label can show the threshold being reached.
        steps.push({ at: input.at, event: input.event, fired, state: at, counters: next });
        counters = fired === undefined ? next : transitions.map(() => 0);
    }
    return steps;
}
