import { Effect } from "effect";

import type { InventoryLayout } from "~/ui/pixi/layout/SceneLayout";

export namespace readInventoryLayoutFx {
	export interface Props {
		readonly columns: number;
		readonly height: number;
		readonly preferredCellSize: number;
		readonly rows: number;
		readonly width: number;
	}
}

/** Centers Inventory at Board scale, shrinking only when its grid cannot fit the viewport. */
export const readInventoryLayoutFx = Effect.fn("readInventoryLayoutFx")(
	({ columns, height, preferredCellSize, rows, width }: readInventoryLayoutFx.Props) =>
		Effect.sync((): InventoryLayout => {
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
		}),
);
