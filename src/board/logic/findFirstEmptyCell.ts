import type { BoardView } from "~/board/view/BoardViewSchema";

export function findFirstEmptyCell(byCellKey: BoardView["byCellKey"]): BoardView["firstEmptyCell"] {
	for (let y = 0; y < 9; y++) {
		for (let x = 0; x < 7; x++) {
			if (!byCellKey[`${x}:${y}`]) {
				return {
					x,
					y,
				};
			}
		}
	}

	return undefined;
}
