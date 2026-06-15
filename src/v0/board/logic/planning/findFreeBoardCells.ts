import type { SaveShape } from "~/v0/play/save/model/SaveShape";
import { manhattanDistance } from "./manhattanDistance";

export namespace findFreeBoardCells {
	export interface BoardRow {
		x: number;
		y: number;
	}
}

export const findFreeBoardCells = (
	save: SaveShape,
	boardRows: readonly findFreeBoardCells.BoardRow[],
	origin?: findFreeBoardCells.BoardRow,
) => {
	const occupied = new Set(boardRows.map((item) => `${item.x}:${item.y}`));
	const cells: findFreeBoardCells.BoardRow[] = [];

	for (let y = 0; y < save.boardHeight; y += 1) {
		for (let x = 0; x < save.boardWidth; x += 1) {
			if (!occupied.has(`${x}:${y}`))
				cells.push({
					x,
					y,
				});
		}
	}

	if (!origin) return cells;

	return cells.sort((a, b) => {
		const aDistance = manhattanDistance(a, origin);
		const bDistance = manhattanDistance(b, origin);

		if (aDistance !== bDistance) return aDistance - bDistance;
		if (a.y !== b.y) return a.y - b.y;
		return a.x - b.x;
	});
};
