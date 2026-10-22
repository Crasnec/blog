/**
 * grid-search — a path-finding algorithm exploring a maze, cell by cell.
 *
 * The search really runs, once, in `decode`: BFS, DFS, greedy best-first or
 * A* (Manhattan distance) over the maze in the props, recording the order in
 * which cells were expanded, when each was first discovered, and the path it
 * found. `draw` replays that record at a fixed number of cells per second, so
 * two figures on the same maze finish at different moments and the reader sees
 * which one did less work. Finished cells fill in, the frontier (discovered but
 * not yet expanded) is outlined, and the found path is traced last.
 *
 *   <Figure kind="grid-search" props={{
 *     algorithm: "astar",
 *     maze: [
 *       "S....#....",
 *       ".##..#.##.",
 *       "....#...#G",
 *     ],
 *   }} />
 *
 * `#` is a wall, `.` open floor, `S` the start and `G` the goal. Rows must all
 * be the same length.
 */

import {
    arr,
    box,
    defineFigure,
    dot,
    ease,
    fitAspect,
    gridCell,
    label,
    maybe,
    obj,
    partialPath,
    progress,
    ring,
    str,
    text,
    withAlpha,
    type Point,
} from "../kit.ts";
import type { JsonValue } from "../../utils/json.ts";

import {
    searchGrid as search,
    type Algorithm,
    type Maze,
    type Search,
} from "../models/grid-search.ts";

/* — 1. pacing ——————————————————————————————————————————————————————— */

const TIMES = {
    /** The maze fades in. */
    appear: 0.6,
    /** Expansion starts. */
    search: 0.7,
    /**
     * Cells expanded per second. Fixed rather than fitted to the figure, so a
     * search that does less work visibly finishes sooner.
     */
    rate: 38,
    /** Longest the expansion may take; bigger searches speed up to fit. */
    maxSearch: 7,
    /** Each cell's fill fades in over this long. */
    fade: 0.18,
    /** Pause after the goal is reached, then the path draws. */
    pause: 0.3,
    path: 1.1,
} as const;

const DURATION = TIMES.search + TIMES.maxSearch + TIMES.pause + TIMES.path + 0.8;

/* — 2. the search ———————————————————————————————————————————————————— */

const ALGORITHMS: readonly Algorithm[] = ["bfs", "dfs", "greedy", "astar"];

const NAMES: Record<Algorithm, string> = {
    bfs: "BFS · breadth first",
    dfs: "DFS · depth first",
    greedy: "Greedy · goal first",
    astar: "A* · cost + estimate",
};

/* — 3. props ————————————————————————————————————————————————————————— */

interface Props {
    maze: Maze;
    algorithm: Algorithm;
    title: string;
    run: Search;
    /** Seconds per expansion, after fitting into `TIMES.maxSearch`. */
    step: number;
}

function readMaze(raw: JsonValue[], path: string): Maze {
    const lines = raw.map((row, i) => str(row, `${path}[${String(i)}]`));
    if (lines.length < 3 || lines.length > 30) {
        throw new Error(`${path} must have from 3 to 30 rows; it has ${String(lines.length)}`);
    }
    const cols = lines[0]?.length ?? 0;
    if (cols < 3 || cols > 40) {
        throw new Error(
            `${path} rows must be from 3 to 40 characters long; row 0 has ${String(cols)}`,
        );
    }
    const walls: boolean[] = [];
    let start = -1;
    let goal = -1;
    for (const [r, line] of lines.entries()) {
        if (line.length !== cols) {
            throw new Error(
                `${path} rows must all be the same length: row ${String(r)} has ${String(line.length)}, row 0 has ${String(cols)}`,
            );
        }
        for (let c = 0; c < line.length; c++) {
            const ch = line.charAt(c);
            const cell = r * cols + c;
            if (ch === "S" || ch === "G") {
                const which = ch === "S" ? "start" : "goal";
                if ((ch === "S" ? start : goal) !== -1) {
                    throw new Error(
                        `${path} has more than one ${ch}; there must be exactly one ${which}`,
                    );
                }
                if (ch === "S") start = cell;
                else goal = cell;
            } else if (ch !== "#" && ch !== ".") {
                throw new Error(
                    `${path}[${String(r)}] has "${ch}" at column ${String(c)}; use # . S G`,
                );
            }
            walls.push(ch === "#");
        }
    }
    if (start === -1) throw new Error(`${path} has no S (start)`);
    if (goal === -1) throw new Error(`${path} has no G (goal)`);
    return { cols, rows: lines.length, walls, start, goal };
}

/* — 4. drawing ———————————————————————————————————————————————————————— */

export default defineFigure<Props>({
    duration: DURATION,
    height: 320,
    // Square cells: the header, then the grid at full width, capped so a wide
    // screen does not get a towering board.
    heightFor: (width, props) =>
        Math.max(160, Math.min(360, 26 + 4 + (width * props.maze.rows) / props.maze.cols + 4)),

    decode(raw) {
        const p = obj(raw, "props");
        const maze = readMaze(arr(p.maze, "props.maze"), "props.maze");
        const name = maybe(p.algorithm, "props.algorithm", str) ?? "bfs";
        const algorithm = ALGORITHMS.find((a) => a === name);
        if (!algorithm) {
            throw new Error(
                `props.algorithm must be one of ${ALGORITHMS.join(", ")}; got "${name}"`,
            );
        }
        const run = search(maze, algorithm);
        return {
            maze,
            algorithm,
            title: maybe(p.title, "props.title", str) ?? NAMES[algorithm],
            run,
            // A fixed rate, unless the run is too long to fit; then faster.
            step: Math.min(1 / TIMES.rate, TIMES.maxSearch / run.expanded.length),
        };
    },

    draw(frame, props) {
        const { ctx, width, height, time, palette } = frame;
        const { maze, run } = props;
        const narrow = width < 520;

        /* layout: a header row, then the largest square-celled grid that fits */
        const headerH = 26;
        // Pinned under the header: on a narrow canvas the grid is shorter than
        // the canvas, and the spare height reads better below it than around it.
        const fitted = fitAspect(
            { x: 0, y: headerH, w: width, h: height - headerH - 2 },
            maze.cols,
            maze.rows,
        );
        const board = { ...fitted, y: headerH + 4 };
        const gap = board.w / maze.cols > 14 ? 1.5 : 1;
        const cellAt = (cell: number) =>
            gridCell(
                board,
                maze.cols,
                maze.rows,
                cell % maze.cols,
                Math.floor(cell / maze.cols),
                gap,
            );
        const centreOf = (cell: number): Point => {
            const r = cellAt(cell);
            return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        };
        const size = cellAt(0).w;

        /* when things happen, from the recorded run */
        const stepTime = (step: number) => TIMES.search + step * props.step;
        const searchEnd = stepTime(run.expanded.length - 1);
        const pathStart = searchEnd + TIMES.pause;
        const explored = run.expanded.filter((_, i) => time >= stepTime(i)).length;
        const done = time >= pathStart;

        withAlpha(ctx, ease.out(progress(time, 0, TIMES.appear)), () => {
            /* layer 1: header — what this run is, and how much it has done */
            text(frame, props.title, 0, 15, { size: 12, weight: 700, color: palette.inkStrong });
            const count = done
                ? `Explored ${String(run.expanded.length)} · ${run.path.length === 0 ? "no path" : `path ${String(run.path.length - 1)}`}`
                : `Explored ${String(explored)}`;
            label(frame, count, width, 15, {
                size: narrow ? 11 : 12,
                weight: done ? 700 : 400,
                mono: true,
                color: done ? palette.inkStrong : palette.inkMuted,
                maxX: width,
            });

            /* layer 2: the board — floor and walls */
            for (let cell = 0; cell < maze.cols * maze.rows; cell++) {
                const r = cellAt(cell);
                ctx.fillStyle = maze.walls[cell] ? palette.inkMuted : palette.surface;
                ctx.fillRect(r.x, r.y, r.w, r.h);
            }

            /* layer 3: the search — expanded cells fill, the frontier is outlined */
            for (let cell = 0; cell < maze.cols * maze.rows; cell++) {
                const disc = run.discoveredAt[cell] ?? -1;
                if (disc === -1) continue;
                const exp = run.expandedAt[cell] ?? -1;
                const r = cellAt(cell);
                const filled = exp === -1 ? 0 : progress(time, stepTime(exp), TIMES.fade);
                if (filled > 0) {
                    withAlpha(ctx, filled, () => {
                        ctx.fillStyle = palette.markerWash;
                        ctx.fillRect(r.x, r.y, r.w, r.h);
                    });
                }
                // Discovered but not yet expanded: waiting in the open list.
                const seen = time >= stepTime(disc);
                const waiting = seen && (exp === -1 || time < stepTime(exp));
                if (waiting) {
                    ctx.strokeStyle = palette.marker;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
                }
            }

            // The cell being expanded right now.
            if (!done && explored > 0) {
                const now = run.expanded[explored - 1];
                if (now !== undefined) {
                    const c = centreOf(now);
                    dot(ctx, c.x, c.y, Math.max(2, size * 0.18), palette.inkStrong);
                }
            }

            /* layer 4: the path, traced once the goal is reached */
            const traced = ease.inOut(progress(time, pathStart, TIMES.path));
            if (traced > 0) {
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.strokeStyle = palette.marker;
                ctx.lineWidth = Math.max(2.5, size * 0.32);
                partialPath(ctx, run.path.map(centreOf), traced);
            }

            /* layer 5: start and goal, on top of everything */
            const s = cellAt(maze.start);
            const g = cellAt(maze.goal);
            box(ctx, s.x, s.y, s.w, s.h, 2, palette.inkStrong);
            box(ctx, g.x, g.y, g.w, g.h, 2, palette.paper, palette.marker, 2);
            const letter = Math.max(11, Math.min(14, size * 0.6));
            if (size >= 13) {
                text(frame, "S", s.x + s.w / 2, s.y + s.h / 2 + letter * 0.36, {
                    align: "center",
                    size: letter,
                    weight: 700,
                    color: palette.paper,
                });
                text(frame, "G", g.x + g.w / 2, g.y + g.h / 2 + letter * 0.36, {
                    align: "center",
                    size: letter,
                    weight: 700,
                    color: palette.marker,
                });
            } else {
                const gc = centreOf(maze.goal);
                ring(ctx, gc.x, gc.y, size * 0.25, palette.marker, 1.5);
            }
        });
    },
});
