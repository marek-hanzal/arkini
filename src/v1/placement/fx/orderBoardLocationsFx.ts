import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";

export namespace orderBoardLocationsFx {
	export interface Props {
		locations: ReadonlyArray<GridLocationSchema.Type>;
		origin: PositionSchema.Type;
	}
}

const compareByScanOrder = (left: GridLocationSchema.Type, right: GridLocationSchema.Type) => {
	return left.position.y - right.position.y || left.position.x - right.position.x;
};

/** Orders board locations by Manhattan distance from one resolved placement origin. */
export const orderBoardLocationsFx = Effect.fn("orderBoardLocationsFx")(function* ({
	locations,
	origin,
}: orderBoardLocationsFx.Props) {
	return [
		...locations,
	].sort((left, right) => {
		const leftDistance =
			Math.abs(left.position.x - origin.x) + Math.abs(left.position.y - origin.y);
		const rightDistance =
			Math.abs(right.position.x - origin.x) + Math.abs(right.position.y - origin.y);

		return leftDistance - rightDistance || compareByScanOrder(left, right);
	});
});
