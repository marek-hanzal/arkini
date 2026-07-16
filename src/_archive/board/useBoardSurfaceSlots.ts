import { useMemo } from "react";
import { readBoardCells, type BoardCellView } from "~/board/boardCells";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const useBoardSurfaceSlots = ({ boardLayout }: { boardLayout: readBoardCells.Props }) =>
	useMemo(
		() =>
			readBoardCells(boardLayout).map((cell) => ({
				id: cell.key,
				dropId: `board-cell:${cell.key}`,
				renderKey: cell.key,
				data: cell,
			})) satisfies TileEngine.Slot<BoardCellView>[],
		[
			boardLayout,
		],
	);
