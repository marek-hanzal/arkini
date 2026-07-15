import { Effect, Random } from "effect";
import { match } from "ts-pattern";

import type { GridSizeSchema } from "~/v1/grid/schema/GridSizeSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";

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
		.with("drop", () => Effect.succeed(origin))
		.with("random", () =>
			Random.nextIntBetween(0, size.width * size.height).pipe(
				Effect.map(
					(index) =>
						({
							scope: "board" as const,
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
