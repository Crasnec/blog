/** Post-specific data and captions; all drawing uses reusable typed components. */
import { GridSearch, type DiagramProps } from "#src/components/figures/index.tsx";
import type { FigureInputs } from "#src/figures/inputs.ts";

const sharedMaze: FigureInputs["grid-search"]["maze"] = [
    "#..........#.#......#",
    "..................#..",
    "........#......#..#..",
    ".............##.#.##.",
    "............#.#..##..",
    ".......#...#.........",
    ".S...#...##....#...G.",
    "#....##.....##.......",
    "#...###..#...#.......",
    ".##...##.......#..#..",
    "######........##.....",
    "..##.....#.....#...##",
    "...#..#..#..#..#####.",
];

const bfsMazeData = {
    algorithm: "bfs",
    maze: sharedMaze,
} satisfies FigureInputs["grid-search"];

const greedyMazeData = {
    algorithm: "greedy",
    maze: sharedMaze,
} satisfies FigureInputs["grid-search"];

const aStarMazeData = {
    algorithm: "astar",
    maze: sharedMaze,
} satisfies FigureInputs["grid-search"];

export function BfsMaze(input: Partial<DiagramProps<"grid-search">>) {
    return (
        <GridSearch
            props={bfsMazeData}
            caption="BFS expands in all directions, finding a shortest path while exploring much of the maze."
            {...input}
        />
    );
}

export function GreedyMaze(input: Partial<DiagramProps<"grid-search">>) {
    return (
        <GridSearch
            props={greedyMazeData}
            caption="Greedy search explores fewer cells here but returns a longer path than BFS."
            {...input}
        />
    );
}

export function AStarMaze(input: Partial<DiagramProps<"grid-search">>) {
    return (
        <GridSearch
            props={aStarMazeData}
            caption="A* matches the shortest path found by BFS while exploring fewer cells."
            {...input}
        />
    );
}
