import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

interface ReadMainLayoutProps {
	readonly boardHeight: number;
	readonly boardWidth: number;
}

const boardCellSize = 512;

/** Computes fixed world-cell geometry for the camera-controlled Board. */
export const readMainLayoutFn = ({
	boardHeight,
	boardWidth,
}: ReadMainLayoutProps): SurfaceLayout => {
	return {
		cellSize: boardCellSize,
		columns: boardWidth,
		height: boardHeight * boardCellSize,
		kind: "board",
		rows: boardHeight,
		width: boardWidth * boardCellSize,
		x: 0,
		y: 0,
	};
};
