import { Effect } from "effect";

import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";
import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";

export namespace createBoardRectangleFx {
	export interface Props {
		anchor: BoardLocationSchema.Type;
		footprint: GridSizeSchema.Type;
	}
}

/** Captures one Board anchor and its effective footprint as a shared rectangle value. */
export const createBoardRectangleFx = Effect.fn("createBoardRectangleFx")(function* ({
	anchor,
	footprint,
}: createBoardRectangleFx.Props) {
	return {
		space: anchor.space,
		anchor: {
			x: anchor.position.x,
			y: anchor.position.y,
		},
		footprint: {
			width: footprint.width,
			height: footprint.height,
		},
	} satisfies BoardRectangleSchema.Type;
});
