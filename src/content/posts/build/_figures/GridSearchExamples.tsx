/** Post-specific data and captions; all drawing uses reusable typed components. */
import { GridSearch, type DiagramProps } from "../../../../components/figures";
import type { FigureInputs } from "../../../../figures/inputs";

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
	maze: sharedMaze
} satisfies FigureInputs["grid-search"];

const greedyMazeData = {
	algorithm: "greedy",
	maze: sharedMaze
} satisfies FigureInputs["grid-search"];

const aStarMazeData = {
	algorithm: "astar",
	maze: sharedMaze
} satisfies FigureInputs["grid-search"];

export function BfsMaze(input: Partial<DiagramProps<"grid-search">>) {
	return <GridSearch props={bfsMazeData} caption="BFS는 목표가 어느 쪽인지 모르고 사방으로 퍼진다. 가장 짧은 길을 찾지만 미로의 대부분을 들여다본다." {...input} />;
}

export function GreedyMaze(input: Partial<DiagramProps<"grid-search">>) {
	return <GridSearch props={greedyMazeData} caption="탐욕 탐색은 가장 적은 칸만 보고 끝나지만, 찾은 길은 BFS의 최단 경로보다 열 칸이나 길다." {...input} />;
}

export function AStarMaze(input: Partial<DiagramProps<"grid-search">>) {
	return <GridSearch props={aStarMazeData} caption="A*는 BFS와 같은 길이의 최단 경로를 찾으면서, 확인하는 칸은 BFS의 3분의 1도 안 된다." {...input} />;
}
