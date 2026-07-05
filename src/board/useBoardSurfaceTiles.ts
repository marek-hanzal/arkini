import { useMemo } from "react";
import { useBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import { cellKey } from "~/board/cellKey";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

const transientTileStyle = {
	pointerEvents: "none" as const,
};

export const useBoardSurfaceTiles = ({
	board,
	transientTiles,
}: {
	board: ReturnType<typeof useGameBoardView>;
	transientTiles: ReturnType<typeof useBoardTransientTiles>;
}) =>
	useMemo(
		() =>
			[
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
					};
				}),
				...transientTiles.map((tile) => ({
					id: tile.id,
					slotId: tile.slotId,
					renderKey: `static-item:${tile.id}:${tile.slotId}:${tile.itemId}:${tile.assetProgress ?? "none"}`,
					data: {
						assetProgress: tile.assetProgress,
						kind: "static-item" as const,
						itemId: tile.itemId,
					},
					disabled: true,
					style: transientTileStyle,
				})),
			] satisfies TileEngine.Tile<BoardSurface.TileData>[],
		[
			board.items,
			transientTiles,
		],
	);
