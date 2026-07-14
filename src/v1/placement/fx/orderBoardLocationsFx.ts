import { Chunk, Effect, Random } from "effect";
import { match } from "ts-pattern";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";

export namespace orderBoardLocationsFx {
	export interface Props {
		locations: ReadonlyArray<GridLocationSchema.Type>;
		origin: PositionSchema.Type;
		placement: PlacementEnumSchema.Type;
	}
}

const compareByScanOrder = (left: GridLocationSchema.Type, right: GridLocationSchema.Type) => {
	return left.position.y - right.position.y || left.position.x - right.position.x;
};

/**
 * Orders free board locations according to one resolved board placement strategy.
 */
export const orderBoardLocationsFx = Effect.fn("orderBoardLocationsFx")(function* ({
	locations,
	origin,
	placement,
}: orderBoardLocationsFx.Props) {
	return yield* match(placement)
		.with("drop", () => {
			return Effect.succeed(
				[
					...locations,
				].sort((left, right) => {
					const leftDistance =
						Math.abs(left.position.x - origin.x) + Math.abs(left.position.y - origin.y);
					const rightDistance =
						Math.abs(right.position.x - origin.x) +
						Math.abs(right.position.y - origin.y);

					return leftDistance - rightDistance || compareByScanOrder(left, right);
				}),
			);
		})
		.with("random", () => {
			if (locations.length <= 1) {
				return Effect.succeed([
					...locations,
				]);
			}

			return Random.shuffle(locations).pipe(
				Effect.map((shuffled) => Chunk.toReadonlyArray(shuffled)),
			);
		})
		.exhaustive();
});
