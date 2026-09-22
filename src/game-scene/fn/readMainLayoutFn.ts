import type { MainLayout } from "~/game-scene/type/SceneLayout";

interface ReadMainLayoutProps {
	readonly boardHeight: number;
	readonly boardWidth: number;
	readonly height: number;
	readonly fixedCellSize?: number;
	readonly width: number;
}

const minimumViewportPadding = 12;
const maximumViewportPadding = 48;
const viewportPaddingRatio = 0.04;

/** Computes Board geometry, with fixed world cells for camera-controlled scenes. */
export const readMainLayoutFn = ({
	boardHeight,
	boardWidth,
	height,
	fixedCellSize,
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
	const heightPerSceneWidth = boardHeight / boardWidth;
	const sceneWidth = Math.max(1, Math.min(availableWidth, availableHeight / heightPerSceneWidth));
	const originX =
		fixedCellSize === undefined ? viewportPadding + (availableWidth - sceneWidth) / 2 : 0;
	const boardCellSize = fixedCellSize ?? sceneWidth / boardWidth;
	const sceneHeight = boardHeight * boardCellSize;
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
		viewportPadding: fixedCellSize === undefined ? viewportPadding : 0,
	};
};
