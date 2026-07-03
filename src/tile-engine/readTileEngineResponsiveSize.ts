import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace readTileEngineResponsiveSize {
	export interface Props {
		availableHeight: number;
		availableWidth: number;
		columns: number;
		gapPx: number;
		rowCount: number;
	}
}

export const readTileEngineResponsiveSize = ({
	availableHeight,
	availableWidth,
	columns,
	gapPx,
	rowCount,
}: readTileEngineResponsiveSize.Props): TileEngine.Size | null => {
	if (columns <= 0 || rowCount <= 0) return null;
	if (availableWidth <= 0 || availableHeight <= 0) return null;

	const horizontalGapPx = Math.max(0, columns - 1) * gapPx;
	const verticalGapPx = Math.max(0, rowCount - 1) * gapPx;
	const availableCellWidth = (availableWidth - horizontalGapPx) / columns;
	const availableCellHeight = (availableHeight - verticalGapPx) / rowCount;
	const cellSizePx = Math.min(availableCellWidth, availableCellHeight);
	if (cellSizePx <= 0) return null;

	return {
		height: cellSizePx * rowCount + verticalGapPx,
		width: cellSizePx * columns + horizontalGapPx,
	};
};
