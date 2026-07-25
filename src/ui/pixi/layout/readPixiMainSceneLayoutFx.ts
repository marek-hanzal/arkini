import { Effect } from "effect";

import type { PixiMainSceneLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace readPixiMainSceneLayoutFx {
	export interface Props {
		readonly boardHeight: number;
		readonly boardWidth: number;
		readonly height: number;
		readonly toolbarSize: number;
		readonly width: number;
	}
}

const minimumViewportPadding = 12;
const maximumViewportPadding = 48;
const viewportPaddingRatio = 0.04;
const toolbarGapInBoardCells = 0.25;

/** Fits Board and optional Toolbar into the full-screen native Pixi viewport. */
export const readPixiMainSceneLayoutFx = Effect.fn("readPixiMainSceneLayoutFx")(
	({ boardHeight, boardWidth, height, toolbarSize, width }: readPixiMainSceneLayoutFx.Props) =>
		Effect.sync((): PixiMainSceneLayout => {
			const shortestViewportSide = Math.min(width, height);
			const maximumFittingPadding = Math.max(0, (shortestViewportSide - 1) / 2);
			const viewportPadding = Math.min(
				maximumFittingPadding,
				Math.min(
					maximumViewportPadding,
					Math.max(minimumViewportPadding, shortestViewportSide * viewportPaddingRatio),
				),
			);
			const availableWidth = Math.max(1, width - viewportPadding * 2);
			const availableHeight = Math.max(1, height - viewportPadding * 2);
			const heightPerSceneWidth =
				boardHeight / boardWidth +
				(toolbarSize > 0 ? toolbarGapInBoardCells / boardWidth + 1 / toolbarSize : 0);
			const sceneWidth = Math.max(
				1,
				Math.min(availableWidth, availableHeight / heightPerSceneWidth),
			);
			const boardCellSize = sceneWidth / boardWidth;
			const toolbarCellSize = toolbarSize > 0 ? sceneWidth / toolbarSize : 0;
			const toolbarGap = toolbarSize > 0 ? boardCellSize * toolbarGapInBoardCells : 0;
			const sceneHeight =
				boardHeight * boardCellSize + (toolbarSize > 0 ? toolbarGap + toolbarCellSize : 0);
			const originX = viewportPadding + (availableWidth - sceneWidth) / 2;
			const originY = viewportPadding + (availableHeight - sceneHeight) / 2;

			return {
				board: {
					cellSize: boardCellSize,
					columns: boardWidth,
					height: boardHeight * boardCellSize,
					kind: "board",
					rows: boardHeight,
					width: sceneWidth,
					x: originX,
					y: originY,
				},
				toolbar:
					toolbarSize === 0
						? null
						: {
								cellSize: toolbarCellSize,
								columns: toolbarSize,
								height: toolbarCellSize,
								kind: "toolbar",
								rows: 1,
								width: sceneWidth,
								x: originX,
								y: originY + boardHeight * boardCellSize + toolbarGap,
							},
				toolbarGap,
				viewportPadding,
			};
		}),
);
