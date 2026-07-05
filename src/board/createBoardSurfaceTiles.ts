import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import { cellKey } from "~/board/cellKey";
import type { BoardSurface } from "~/board/BoardSurface.types";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

const transientTileStyle = {
	pointerEvents: "none" as const,
};

export const createBoardSurfaceTiles = ({
	board,
	transientTiles,
}: {
	board: BoardView;
	transientTiles: readonly BoardTransientTile[];
}): TileEngine.Tile<BoardSurface.TileData>[] => {
	const hiddenBoardItemIds = new Set(
		transientTiles.flatMap((tile) =>
			tile.hiddenBoardItemId
				? [
						tile.hiddenBoardItemId,
					]
				: [],
		),
	);

	return [
		...board.items.map((boardItem) => {
			const slotId = cellKey(boardItem.x, boardItem.y);

			return {
				id: boardItem.id,
				slotId,
				renderKey: `board-item:${boardItem.id}:${slotId}`,
				data: {
					kind: "board-item" as const,
					boardItemId: boardItem.id,
				},
				disabled: false,
				hidden: hiddenBoardItemIds.has(boardItem.id),
			};
		}),
		...transientTiles.map((tile) => ({
			id: tile.id,
			slotId: tile.slotId,
			renderKey: `static-item:${tile.id}:${tile.slotId}:${tile.itemId}:${tile.quantity ?? 1}:${tile.assetProgress ?? "none"}`,
			data: {
				assetProgress: tile.assetProgress,
				kind: "static-item" as const,
				itemId: tile.itemId,
				quantity: tile.quantity,
			},
			disabled: true,
			style: transientTileStyle,
		})),
	];
};
