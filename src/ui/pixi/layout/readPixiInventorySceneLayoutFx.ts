import { Effect } from "effect";

import type { PixiInventorySceneLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace readPixiInventorySceneLayoutFx {
	export interface Props {
		readonly actorSize: number;
		readonly columns: number;
		readonly height: number;
		readonly rows: number;
		readonly width: number;
	}
}

/** Fits the isolated Inventory grid into its modal-local Pixi viewport. */
export const readPixiInventorySceneLayoutFx = Effect.fn("readPixiInventorySceneLayoutFx")(
	({ actorSize, columns, height, rows, width }: readPixiInventorySceneLayoutFx.Props) =>
		Effect.sync((): PixiInventorySceneLayout => {
			const normalizedActorSize = Math.max(1, actorSize);
			const cellSize = Math.max(
				normalizedActorSize,
				Math.min(width / columns, height / rows),
			);
			const gridWidth = columns * cellSize;
			const gridHeight = rows * cellSize;
			return {
				actorSize: normalizedActorSize,
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
