import { Effect, Random } from "effect";
import { match } from "ts-pattern";

import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace resolveBoardPlacementOriginFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		placement: PlacementEnumSchema.Type;
		size: GridSizeSchema.Type;
	}
}

/** Resolves one board-space origin used by canonical nearest-first placement. */
export const resolveBoardPlacementOriginFx = Effect.fn("resolveBoardPlacementOriginFx")(function* ({
	origin,
	placement,
	size,
}: resolveBoardPlacementOriginFx.Props) {
	return yield* match(placement)
		.with(PlacementEnumSchema.enum.Drop, () => Effect.succeed(origin))
		.with(PlacementEnumSchema.enum.Random, () =>
			Random.nextIntBetween(0, size.width * size.height).pipe(
				Effect.map(
					(index) =>
						({
							scope: LocationScopeEnumSchema.enum.Board,
							space: origin.space,
							position: {
								x: index % size.width,
								y: Math.floor(index / size.width),
							},
						}) satisfies BoardLocationSchema.Type,
				),
			),
		)
		.exhaustive();
});
