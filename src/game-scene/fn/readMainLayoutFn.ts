import type { MainLayout } from "~/game-scene/type/SceneLayout";

interface ReadMainLayoutProps {
	readonly boardHeight: number;
	readonly boardWidth: number;
	readonly height: number;
	readonly fixedCellSize?: number;
	readonly toolbarSize: number;
	readonly width: number;
}

const minimumViewportPadding = 12;
const maximumViewportPadding = 48;
const viewportPaddingRatio = 0.04;
const toolbarGapInBoardCells = 0.25;

/** Computes Board and Toolbar geometry, with fixed world cells for camera-controlled scenes. */
export const readMainLayoutFn = ({
	boardHeight,
	boardWidth,
	height,
	fixedCellSize,
	toolbarSize,
	width,
}: ReadMainLayoutProps): MainLayout => {
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
	const sceneWidth = Math.max(1, Math.min(availableWidth, availableHeight / heightPerSceneWidth));
	const boardCellSize = fixedCellSize ?? sceneWidth / boardWidth;
	const toolbarCellSize = toolbarSize > 0 ? (fixedCellSize ?? sceneWidth / toolbarSize) : 0;
	const toolbarGap = toolbarSize > 0 ? boardCellSize * toolbarGapInBoardCells : 0;
	const sceneHeight =
		boardHeight * boardCellSize + (toolbarSize > 0 ? toolbarGap + toolbarCellSize : 0);
	const originX =
		fixedCellSize === undefined ? viewportPadding + (availableWidth - sceneWidth) / 2 : 0;
	const originY =
		fixedCellSize === undefined ? viewportPadding + (availableHeight - sceneHeight) / 2 : 0;

	return {
		board: {
			cellSize: boardCellSize,
			columns: boardWidth,
			height: boardHeight * boardCellSize,
			kind: "board",
			rows: boardHeight,
			width: boardWidth * boardCellSize,
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
						width: toolbarSize * toolbarCellSize,
						x:
							originX +
							(boardWidth * boardCellSize - toolbarSize * toolbarCellSize) / 2,
						y: originY + boardHeight * boardCellSize + toolbarGap,
					},
		toolbarGap,
		viewportPadding: fixedCellSize === undefined ? viewportPadding : 0,
	};
};
