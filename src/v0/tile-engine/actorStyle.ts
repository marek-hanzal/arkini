import type { CSSProperties } from "react";

const gridCellSize = (count: number, gapPx: number) =>
	`calc((100% - ${(count - 1) * gapPx}px) / ${count})`;

const gridCellOffset = (index: number, count: number, gapPx: number) =>
	`calc(${index} * (${gridCellSize(count, gapPx)} + ${gapPx}px))`;

export const actorStyle = ({
	columns,
	rowCount,
	index,
	gapPx,
}: {
	columns: number;
	rowCount: number;
	index: number;
	gapPx: number;
}): CSSProperties => {
	const column = index % columns;
	const row = Math.floor(index / columns);

	return {
		left: gridCellOffset(column, columns, gapPx),
		top: gridCellOffset(row, rowCount, gapPx),
		width: gridCellSize(columns, gapPx),
		height: gridCellSize(rowCount, gapPx),
	};
};
