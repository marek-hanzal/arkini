import { Effect } from "effect";

import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace readBoardRectangleManhattanGapFx {
	export interface Props {
		left: BoardRectangleSchema.Type;
		right: BoardRectangleSchema.Type;
	}
}

/**
 * Reads the minimum Manhattan distance between occupied cells of two Board rectangles.
 *
 * Callers must compare rectangles in the same space; cross-space distance has no
 * deterministic placement meaning.
 */
export const readBoardRectangleManhattanGapFx = Effect.fn("readBoardRectangleManhattanGapFx")(
	function* ({ left, right }: readBoardRectangleManhattanGapFx.Props) {
		if (left.space !== right.space) {
			return yield* Effect.die(
				new Error(
					`Cannot read Board rectangle gap across spaces ${left.space} and ${right.space}.`,
				),
			);
		}

		const horizontalGap = Math.max(
			0,
			right.anchor.x - (left.anchor.x + left.footprint.width - 1),
			left.anchor.x - (right.anchor.x + right.footprint.width - 1),
		);
		const verticalGap = Math.max(
			0,
			right.anchor.y - (left.anchor.y + left.footprint.height - 1),
			left.anchor.y - (right.anchor.y + right.footprint.height - 1),
		);

		return horizontalGap + verticalGap;
	},
);
