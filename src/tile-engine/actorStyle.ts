import type { CSSProperties } from "react";

export const actorStyle = ({
	columns,
	index,
}: {
	columns: number;
	rowCount: number;
	index: number;
	gapPx: number;
}): CSSProperties => {
	const column = index % columns;
	const row = Math.floor(index / columns);

	return {
		gridColumnStart: column + 1,
		gridRowStart: row + 1,
		height: "100%",
		minHeight: 0,
		minWidth: 0,
		width: "100%",
	};
};
