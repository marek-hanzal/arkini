import { Effect, Random } from "effect";
import { match } from "ts-pattern";

import type { GridSizeSchema } from "~/v1/grid/schema/GridSizeSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";

export namespace resolveBoardPlacementOriginFx {
	export interface Props {
		origin: PositionSchema.Type;
		placement: PlacementEnumSchema.Type;
		size: GridSizeSchema.Type;
	}
}

/** Resolves the spatial origin used by canonical nearest-first board placement. */
export const resolveBoardPlacementOriginFx = Effect.fn("resolveBoardPlacementOriginFx")(function* ({
	origin,
	placement,
	size,
}: resolveBoardPlacementOriginFx.Props) {
	return yield* match(placement)
		.with("drop", () => Effect.succeed(origin))
		.with("random", () => {
			return Random.nextIntBetween(0, size.width * size.height).pipe(
				Effect.map((index) => {
					return {
						x: index % size.width,
						y: Math.floor(index / size.width),
					} satisfies PositionSchema.Type;
				}),
			);
		})
		.exhaustive();
});
