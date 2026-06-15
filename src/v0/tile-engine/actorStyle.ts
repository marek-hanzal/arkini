import type { CSSProperties } from "react";

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
		left: `${(column * 100) / columns}%`,
		top: `${(row * 100) / rowCount}%`,
		width: `${100 / columns}%`,
		height: `${100 / rowCount}%`,
		paddingRight: column === columns - 1 ? 0 : gapPx,
		paddingBottom: row === rowCount - 1 ? 0 : gapPx,
	};
};
