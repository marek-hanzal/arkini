import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameSave } from "~/engine/model/GameSaveSchema";

const boardCellKey = (cell: BoardCell) => `${cell.x}:${cell.y}`;

const compareBoardCellsByScanOrder = (left: BoardCell, right: BoardCell) =>
	left.y - right.y || left.x - right.x;

const compareBoardCellsBySeedDistance =
	(seedCell: BoardCell) => (left: BoardCell, right: BoardCell) => {
		const leftDistance = Math.abs(left.x - seedCell.x) + Math.abs(left.y - seedCell.y);
		const rightDistance = Math.abs(right.x - seedCell.x) + Math.abs(right.y - seedCell.y);

		return leftDistance - rightDistance || compareBoardCellsByScanOrder(left, right);
	};

export namespace planEmptyBoardCellsFx {
	export interface Props {
		config: GameConfig;
		freedBoardItemInstanceIds?: ReadonlySet<string>;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const planEmptyBoardCellsFx = Effect.fn("planEmptyBoardCellsFx")(function* ({
	config,
	freedBoardItemInstanceIds,
	save,
	seedCell,
}: planEmptyBoardCellsFx.Props) {
	const occupiedCells = new Set(
		Object.entries(save.board.items)
			.filter(([itemInstanceId]) => !freedBoardItemInstanceIds?.has(itemInstanceId))
			.map(([, item]) => boardCellKey(item)),
	);
	const emptyCells: BoardCell[] = [];

	for (let y = 0; y < config.game.board.height; y += 1) {
		for (let x = 0; x < config.game.board.width; x += 1) {
			const cell = {
				x,
				y,
			};

			if (!occupiedCells.has(boardCellKey(cell))) {
				emptyCells.push(cell);
			}
		}
	}

	return emptyCells.sort(
		seedCell ? compareBoardCellsBySeedDistance(seedCell) : compareBoardCellsByScanOrder,
	);
});
