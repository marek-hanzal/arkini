import type { InventoryLayout } from "~/game-scene/type/SceneLayout";

interface ReadInventoryLayoutProps {
	readonly columns: number;
	readonly height: number;
	readonly preferredCellSize: number;
	readonly rows: number;
	readonly width: number;
}

/** Centers Inventory at Board scale, shrinking only when its grid cannot fit the viewport. */
export const readInventoryLayoutFn = ({
	columns,
	height,
	preferredCellSize,
	rows,
	width,
}: ReadInventoryLayoutProps): InventoryLayout => {
	const cellSize = Math.max(
		1,
		Math.min(
			Math.max(1, preferredCellSize),
			Math.max(1, width) / columns,
			Math.max(1, height) / rows,
		),
	);
	const gridWidth = columns * cellSize;
	const gridHeight = rows * cellSize;
	return {
		actorSize: cellSize,
		surface: {
			cellSize,
			columns,
			height: gridHeight,
			kind: "inventory",
			rows,
			width: gridWidth,
			x: (width - gridWidth) / 2,
			y: (height - gridHeight) / 2,
		},
	};
};
