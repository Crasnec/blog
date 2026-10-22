/** Reusable deterministic model, independent of canvas rendering and post data. */
export type Algorithm = "bfs" | "dfs" | "greedy" | "astar";

export interface Maze {
    cols: number;
    rows: number;
    walls: boolean[];
    start: number;
    goal: number;
}

export interface Search {
    /** Cells in the order they were expanded; the goal is last. */
    expanded: number[];
    /** Expansion step at which each cell was first discovered, or -1. */
    discoveredAt: number[];
    /** Expansion step of each cell, or -1. */
    expandedAt: number[];
    /** Start to goal, inclusive. */
    path: number[];
}

/** Up, right, down, left: a fixed order, so every run explores the same way. */
function neighbours(maze: Maze, cell: number): number[] {
    const c = cell % maze.cols;
    const r = Math.floor(cell / maze.cols);
    const out: number[] = [];
    if (r > 0) out.push(cell - maze.cols);
    if (c < maze.cols - 1) out.push(cell + 1);
    if (r < maze.rows - 1) out.push(cell + maze.cols);
    if (c > 0) out.push(cell - 1);
    return out.filter((n) => !maze.walls[n]);
}

function manhattan(maze: Maze, a: number, b: number): number {
    return (
        Math.abs((a % maze.cols) - (b % maze.cols)) +
        Math.abs(Math.floor(a / maze.cols) - Math.floor(b / maze.cols))
    );
}

/*
 * One loop for all four. They differ only in which waiting cell is taken
 * next: the oldest (BFS), the newest (DFS), the one that looks closest to the
 * goal (greedy), or the one with the least distance-so-far plus estimate (A*).
 * Ties go to the cell discovered first, which is what keeps runs repeatable.
 */
export function searchGrid(maze: Maze, algorithm: Algorithm): Search {
    const n = maze.cols * maze.rows;
    const discoveredAt = Array.from({ length: n }, () => -1);
    const expandedAt = Array.from({ length: n }, () => -1);
    const parent = Array.from({ length: n }, () => -1);
    const cost = Array.from({ length: n }, () => Infinity);
    const expanded: number[] = [];

    /** Waiting cells, with the order they were added in. */
    let open: { cell: number; seq: number }[] = [{ cell: maze.start, seq: 0 }];
    let seq = 1;
    discoveredAt[maze.start] = 0;
    cost[maze.start] = 0;

    const h = (cell: number) => manhattan(maze, cell, maze.goal);
    const score = (cell: number): number => {
        switch (algorithm) {
            case "bfs":
                return 0;
            case "dfs":
                return 0;
            case "greedy":
                return h(cell);
            case "astar":
                return (cost[cell] ?? 0) + h(cell);
        }
    };

    while (open.length > 0) {
        let pick = 0;
        for (let i = 1; i < open.length; i++) {
            const a = open[i];
            const b = open[pick];
            if (!a || !b) continue;
            if (algorithm === "dfs") {
                if (a.seq > b.seq) pick = i;
                continue;
            }
            const sa = score(a.cell);
            const sb = score(b.cell);
            // A* breaks ties towards the goal, which keeps it from fanning out
            // across a whole band of equally good cells.
            const better =
                sa < sb ||
                (sa === sb && algorithm === "astar" && h(a.cell) < h(b.cell)) ||
                (sa === sb && (algorithm !== "astar" || h(a.cell) === h(b.cell)) && a.seq < b.seq);
            if (better) pick = i;
        }
        const next = open[pick];
        open = open.filter((_, i) => i !== pick);
        if (!next || expandedAt[next.cell] !== -1) continue;

        const step = expanded.length;
        expandedAt[next.cell] = step;
        expanded.push(next.cell);
        if (next.cell === maze.goal) break;

        for (const m of neighbours(maze, next.cell)) {
            if (expandedAt[m] !== -1) continue;
            const g = (cost[next.cell] ?? 0) + 1;
            // BFS and DFS keep a cell's first parent; the weighted searches
            // take a cheaper route when they find one.
            const firstVisit = discoveredAt[m] === -1;
            const cheaper = g < (cost[m] ?? Infinity);
            if (firstVisit || ((algorithm === "astar" || algorithm === "greedy") && cheaper)) {
                if (firstVisit) discoveredAt[m] = step;
                if (cheaper) cost[m] = g;
                if (firstVisit || cheaper) parent[m] = next.cell;
                open.push({ cell: m, seq: seq++ });
            }
        }
    }

    const path: number[] = [];
    if (expandedAt[maze.goal] !== -1) {
        for (let c = maze.goal; c !== -1; c = parent[c] ?? -1) path.unshift(c);
    }
    return { expanded, discoveredAt, expandedAt, path };
}
