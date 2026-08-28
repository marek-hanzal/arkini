import { Effect, Random } from "effect";
import { match } from "ts-pattern";

import type { SizeSchema } from "~/engine/grid/schema/SizeSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace resolveBoardPlacementOriginFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		placement: PlacementSchema.Type;
		size: SizeSchema.Type;
	}
}

/** Resolves one board-space origin used by canonical nearest-first placement. */
export const resolveBoardPlacementOriginFx = Effect.fn("resolveBoardPlacementOriginFx")(function* ({
	origin,
	placement,
	size,
}: resolveBoardPlacementOriginFx.Props) {
	return yield* match(placement)
		.with(PlacementSchema.enum.Drop, () => Effect.succeed(origin))
		.with(PlacementSchema.enum.Random, () =>
			Random.nextIntBetween(0, size.width * size.height, {
				halfOpen: true,
			}).pipe(
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
