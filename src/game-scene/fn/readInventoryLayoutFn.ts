import type { InventoryLayout } from "~/game-scene/type/SceneLayout";

interface ReadInventoryLayoutProps {
	readonly columns: number;
	readonly rows: number;
}

/** Inventory geometry remains world-local; the shared board camera owns viewport fitting. */
export const readInventoryLayoutFn = ({
	columns,
	rows,
}: ReadInventoryLayoutProps): InventoryLayout => {
	const cellSize = 512;
	return {
		actorSize: cellSize,
		surface: {
			cellSize,
			columns,
			height: rows * cellSize,
			kind: "inventory",
			rows,
			width: columns * cellSize,
			x: 0,
			y: 0,
		},
	};
};
