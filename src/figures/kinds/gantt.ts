/**
 * gantt — a real CPU scheduler, replayed as a Gantt chart.
 *
 * `decode` runs the chosen policy over the job list, event by event, and
 * records every slice of CPU time it hands out. `draw` sweeps a playhead
 * along the time axis: each job has its own lane, its running slices grow as
 * solid bars (the one running now in the marker colour), the time it spends
 * ready but not running grows as a hatched bar in the warn colour, and its
 * arrival is marked with a small tick. When a job finishes, its waiting time
 * appears in the column on the right; at the end, the header states the
 * averages. Everything shown is a number taken from the schedule.
 *
 *   <Figure kind="gantt" props={{ policy: "rr", quantum: 2, jobs: [...] }} />
 *
 * Props:
 *   policy   "fcfs" | "sjf" | "rr" (required). sjf is non-preemptive.
 *   quantum  time slice for rr (default 2)
 *   cores    1–4 (default 1). With more than one, a strip per core is drawn
 *            under the job lanes.
 *   jobs     { id, arrive, burst }[] — 1–10 jobs; else generated
 *   count    jobs to generate when `jobs` is absent (default 5, 2–10)
 *   seed     seed for generated jobs (default 1)
 *   span     length of the time axis. Give several figures the same span so
 *            their bars are drawn to one scale. Default: the schedule's end.
 *   title    header label (default: the policy name)
 */

import {
    arr,
    defineFigure,
    ease,
    hatch,
    label,
    line,
    maybe,
    mean,
    num,
    obj,
    progress,
    str,
    text,
    tickStep,
    trimNumber,
    withAlpha,
    type Rect,
} from "#src/figures/kit.ts";

import { EPS, schedule, type Policy, type Job, type Schedule } from "#src/figures/models/gantt.ts";
export { schedule } from "#src/figures/models/gantt.ts";

import { generateJobs } from "#src/figures/generators.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    /** Lanes and axis fade in. */
    appear: 0.6,
    /** The playhead leaves t = 0. */
    start: 0.8,
    /** Seconds the playhead takes to cross the whole axis. */
    sweep: 7.2,
    /** The averages replace the live counter. */
    verdictAfter: 0.3,
} as const;

const DURATION = 10;

const POLICIES: readonly Policy[] = ["fcfs", "sjf", "rr"];
const NAMES: Record<Policy, string> = {
    fcfs: "FCFS · arrival order",
    sjf: "SJF · shortest job first",
    rr: "Round robin",
};

/* — 2. the scheduler ————————————————————————————————————————————————— */

/* — 3. props ————————————————————————————————————————————————————————— */

interface Props {
    policy: Policy;
    title: string;
    cores: number;
    jobs: Job[];
    span: number;
    plan: Schedule;
}

/* — 4. drawing ———————————————————————————————————————————————————————— */

const headerHeight = (narrow: boolean) => (narrow ? 50 : 30);
const AXIS = 24;
const LEGEND = 20;
const STRIP = 16;

const laneHeight = (narrow: boolean) => (narrow ? 24 : 28);

const stripsHeight = (cores: number) => (cores > 1 ? 10 + cores * (STRIP + 4) : 0);

export default defineFigure<Props>({
    duration: DURATION,
    height: 260,
    heightFor: (width, props) =>
        headerHeight(width < 520) +
        props.jobs.length * laneHeight(width < 520) +
        stripsHeight(props.cores) +
        AXIS +
        LEGEND,

    decode(raw) {
        const p = obj(raw, "props");
        const policyRaw = str(p.policy, "props.policy");
        const policy = POLICIES.find((x) => x === policyRaw);
        if (!policy) {
            throw new Error(`props.policy must be one of ${POLICIES.join(", ")}`);
        }

        const quantum = maybe(p.quantum, "props.quantum", num) ?? 2;
        if (!(quantum > 0)) {
            throw new Error("props.quantum must be a positive number");
        }
        if (p.quantum !== undefined && policy !== "rr")
        {
            throw new Error('props.quantum only applies to policy "rr"');
        }

        const cores = maybe(p.cores, "props.cores", num) ?? 1;
        if (!Number.isInteger(cores) || cores < 1 || cores > 4)
        {
            throw new Error("props.cores must be 1, 2, 3 or 4");
        }

        let jobs: Job[];
        if (p.jobs !== undefined) {
            jobs = arr(p.jobs, "props.jobs").map((j, i) => {
                const path = `props.jobs[${String(i)}]`;
                const o = obj(j, path);
                const job = {
                    id: str(o.id, `${path}.id`),
                    arrive: num(o.arrive, `${path}.arrive`),
                    burst: num(o.burst, `${path}.burst`),
                };
                if (job.arrive < 0) {
                    throw new Error(`${path}.arrive must be 0 or more`);
                }
                if (!(job.burst > 0)) {
                    throw new Error(`${path}.burst must be more than 0`);
                }
                if (job.id.length === 0 || job.id.length > 4)
                {
                    throw new Error(`${path}.id must be 1–4 characters`);
                }
                return job;
            });
            const ids = new Set(jobs.map((j) => j.id));
            if (ids.size !== jobs.length) {
                throw new Error("props.jobs ids must be unique");
            }
        } else {
            const count = maybe(p.count, "props.count", num) ?? 5;
            if (!Number.isInteger(count) || count < 2 || count > 10)
            {
                throw new Error("props.count must be a whole number from 2 to 10");
            }
            jobs = generateJobs(count, maybe(p.seed, "props.seed", num) ?? 1);
        }
        if (jobs.length < 1 || jobs.length > 10)
        {
            throw new Error("props.jobs must have 1 to 10 jobs");
        }

        const plan = schedule(jobs, policy, quantum, cores);
        const span = maybe(p.span, "props.span", num) ?? Math.ceil(plan.end);
        if (span + EPS < plan.end) {
            throw new Error(
                `props.span is ${String(span)} but this schedule runs until ${String(plan.end)}`,
            );
        }

        return {
            policy,
            title: maybe(p.title, "props.title", str) ?? NAMES[policy],
            cores,
            jobs,
            span,
            plan,
        };
    },

    draw(frame, props) {
        const { ctx, width, time, palette } = frame;
        const { plan, jobs, span } = props;
        const narrow = width < 520;

        /* layout: header, one lane per job, core strips, axis, legend */
        const labelW = narrow ? 34 : 52;
        const resultW = narrow ? 52 : 70;
        const laneH = laneHeight(narrow);
        const plot: Rect = {
            x: labelW,
            y: headerHeight(narrow),
            w: width - labelW - resultW - 8,
            h: jobs.length * laneH,
        };
        const stripsTop = plot.y + plot.h + (props.cores > 1 ? 10 : 0);
        const axisY = stripsTop + (props.cores > 1 ? props.cores * (STRIP + 4) : 0) + 2;
        const x = (v: number) => plot.x + (v / span) * plot.w;

        const laneY = (i: number) => plot.y + i * laneH;
        const barH = laneH - 12;

        const sweep = progress(time, TIMES.start, TIMES.sweep);
        const now = sweep * span;
        const sweeping = sweep > 0 && sweep < 1;

        withAlpha(ctx, ease.out(progress(time, 0, TIMES.appear)), () => {
            /* layer 1: header — live clock while sweeping, averages at the end */
            text(frame, props.title, 0, 14, { size: 12, weight: 700, color: palette.inkStrong });
            const verdict = progress(time, TIMES.start + TIMES.sweep + TIMES.verdictAfter, 0.5);
            if (verdict > 0) {
                const waitAvg = mean(plan.outcomes.map((o) => o.wait));
                const turnAvg = mean(plan.outcomes.map((o) => o.turnaround));
                const parts = [
                    `Mean wait ${trimNumber(waitAvg)}`,
                    `${narrow ? "turn" : "turnaround"} ${trimNumber(turnAvg)}`,
                ];
                if (props.policy === "rr") {
                    parts.push(`switches ${String(plan.switches)}`);
                }
                withAlpha(ctx, verdict, () => {
                    label(frame, parts.join(" · "), width, narrow ? 34 : 14, {
                        size: narrow ? 11 : 12,
                        weight: 700,
                        mono: true,
                        color: palette.marker,
                        maxX: width,
                    });
                });
            } else {
                const finished = plan.outcomes.filter((o) => o.done <= now + EPS).length;
                label(
                    frame,
                    `t = ${trimNumber(Math.min(now, plan.end))} · done ${String(finished)}/${String(jobs.length)}`,
                    width,
                    narrow ? 34 : 14,
                    {
                        size: 11,
                        mono: true,
                        color: palette.inkFaint,
                        maxX: width,
                    },
                );
            }

            /* layer 2: lanes, grid and axis */
            const step = tickStep(span, narrow ? 4 : 8);
            for (let v = 0; v <= span + EPS; v += step) {
                line(ctx, x(v), plot.y, x(v), axisY, palette.ruleFaint);
                text(frame, trimNumber(v), x(v), axisY + 15, {
                    align: v === 0 ? "left" : "center",
                    mono: true,
                    size: 11,
                    color: palette.inkFaint,
                });
            }
            line(ctx, plot.x, axisY, plot.x + plot.w, axisY, palette.rule);
            for (const [i, job] of jobs.entries()) {
                const y = laneY(i);
                line(ctx, plot.x, y + laneH - 1, plot.x + plot.w, y + laneH - 1, palette.ruleFaint);
                text(frame, job.id, 0, y + laneH / 2 + 4, {
                    size: 12,
                    weight: 600,
                    mono: true,
                    color: palette.inkStrong,
                });
                // The job's length beside its name, where there is room for both.
                if (!narrow) {
                    text(frame, trimNumber(job.burst), labelW - 8, y + laneH / 2 + 4, {
                        align: "right",
                        size: 11,
                        mono: true,
                        color: palette.inkFaint,
                    });
                }
            }

            /* layer 3: bars, up to the playhead */
            for (const [i, job] of jobs.entries()) {
                const y = laneY(i) + 6;
                const outcome = plan.outcomes[i];
                if (!outcome) {
                    continue;
                }

                // Arrival: a tick above the lane, once the playhead reaches it.
                if (now + EPS >= job.arrive) {
                    const ax = x(job.arrive);
                    ctx.beginPath();
                    ctx.fillStyle = palette.inkMuted;
                    ctx.moveTo(ax - 4, y - 5);
                    ctx.lineTo(ax + 4, y - 5);
                    ctx.lineTo(ax, y);
                    ctx.closePath();
                    ctx.fill();
                }

                // Waiting: ready but not running.
                for (const w of outcome.waits) {
                    const end = Math.min(w.end, now);
                    if (end <= w.start) {
                        continue;
                    }
                    hatch(
                        ctx,
                        { x: x(w.start), y: y + 2, w: x(end) - x(w.start), h: barH - 4 },
                        palette.warn,
                    );
                }

                // Running.
                for (const s of plan.slices) {
                    if (s.job !== i || now <= s.start) {
                        continue;
                    }
                    const end = Math.min(s.end, now);
                    const live = sweeping && now < s.end;
                    ctx.fillStyle = live ? palette.marker : palette.inkMuted;
                    ctx.fillRect(x(s.start), y, Math.max(1, x(end) - x(s.start) - 1), barH);
                }

                // Result column, once the job is done.
                // A job ending exactly at the end of the axis is shown once the sweep is over.
                const shown = sweep >= 1 ? 1 : progress(now, outcome.done, span * 0.04);
                if (shown > 0) {
                    withAlpha(ctx, shown, () => {
                        text(
                            frame,
                            `wait ${trimNumber(outcome.wait)}`,
                            width,
                            laneY(i) + laneH / 2 + 4,
                            {
                                align: "right",
                                size: 11,
                                mono: true,
                                color: outcome.wait > 0 ? palette.inkStrong : palette.inkFaint,
                            },
                        );
                    });
                }
            }

            /* layer 4: one strip per core, when there is more than one */
            if (props.cores > 1) {
                for (let c = 0; c < props.cores; c++) {
                    const y = stripsTop + c * (STRIP + 4);
                    text(frame, `Core ${String(c + 1)}`, 0, y + STRIP - 4, {
                        size: 11,
                        mono: true,
                        color: palette.inkFaint,
                    });
                    ctx.fillStyle = palette.ruleFaint;
                    ctx.fillRect(plot.x, y, plot.w, STRIP);
                    for (const s of plan.slices) {
                        if (s.core !== c || now <= s.start) {
                            continue;
                        }
                        const end = Math.min(s.end, now);
                        ctx.fillStyle = palette.inkMuted;
                        ctx.fillRect(x(s.start), y, Math.max(1, x(end) - x(s.start) - 1), STRIP);
                        const id = jobs[s.job]?.id ?? "";
                        ctx.font = `600 11px ${palette.mono}`;
                        if (x(end) - x(s.start) > ctx.measureText(id).width + 6) {
                            text(frame, id, x(s.start) + 3, y + STRIP - 4, {
                                size: 11,
                                mono: true,
                                weight: 600,
                                color: palette.paper,
                            });
                        }
                    }
                }
            }

            /* layer 5: the playhead */
            if (sweeping) {
                line(ctx, x(now), plot.y - 4, x(now), axisY, palette.marker, 1.5);
            }

            /* layer 6: legend, under the axis */
            const ly = axisY + AXIS + 12;
            let lx = plot.x;
            ctx.fillStyle = palette.inkMuted;
            ctx.fillRect(lx, ly - 9, 14, 9);
            text(frame, "Run", lx + 19, ly, { size: 11, color: palette.inkMuted });
            lx += narrow ? 52 : 64;
            hatch(ctx, { x: lx, y: ly - 9, w: 14, h: 9 }, palette.warn);
            text(frame, "Wait", lx + 19, ly, { size: 11, color: palette.inkMuted });
            lx += narrow ? 52 : 64;
            ctx.beginPath();
            ctx.fillStyle = palette.inkMuted;
            ctx.moveTo(lx + 3, ly - 9);
            ctx.lineTo(lx + 11, ly - 9);
            ctx.lineTo(lx + 7, ly - 4);
            ctx.closePath();
            ctx.fill();
            text(frame, "Arrival", lx + 19, ly, { size: 11, color: palette.inkMuted });
            if (!narrow) {
                text(frame, "Right-hand values: waiting time", width, ly, {
                    align: "right",
                    size: 11,
                    color: palette.inkFaint,
                });
            }
        });
    },
});

/* — helpers ——————————————————————————————————————————————————————————— */
