import { Effect } from "effect";

import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace readBoardRectangleChebyshevDistanceFx {
	export interface Props {
		left: BoardRectangleSchema.Type;
		right: BoardRectangleSchema.Type;
	}
}

/**
 * Reads the minimum Chebyshev distance between occupied cells of two Board rectangles.
 *
 * Callers must compare rectangles in the same space; cross-space distance has no
 * spatial meaning.
 */
export const readBoardRectangleChebyshevDistanceFx = Effect.fn(
	"readBoardRectangleChebyshevDistanceFx",
)(function* ({ left, right }: readBoardRectangleChebyshevDistanceFx.Props) {
	if (left.space !== right.space) {
		return yield* Effect.die(
			new Error(
				`Cannot read Board rectangle distance across spaces ${left.space} and ${right.space}.`,
			),
		);
	}

	const horizontalDistance = Math.max(
		0,
		right.anchor.x - (left.anchor.x + left.footprint.width - 1),
		left.anchor.x - (right.anchor.x + right.footprint.width - 1),
	);
	const verticalDistance = Math.max(
		0,
		right.anchor.y - (left.anchor.y + left.footprint.height - 1),
		left.anchor.y - (right.anchor.y + right.footprint.height - 1),
	);

	return Math.max(horizontalDistance, verticalDistance);
});
