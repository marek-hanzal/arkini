import { useMemo } from "react";
import { createBoardSurfaceTiles } from "~/board/createBoardSurfaceTiles";
import type { useBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import type { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";

export const useBoardSurfaceTiles = ({
	board,
	transientTiles,
}: {
	board: ReturnType<typeof useGameBoardView>;
	transientTiles: ReturnType<typeof useBoardTransientTiles>;
}) =>
	useMemo(
		() =>
			createBoardSurfaceTiles({
				board,
				transientTiles,
			}),
		[
			board,
			transientTiles,
		],
	);
