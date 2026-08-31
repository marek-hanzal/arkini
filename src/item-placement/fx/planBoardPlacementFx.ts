import { Effect, Random } from "effect";
import { match } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";

interface PlanBoardPlacementProps {
	readonly excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly placement: PlacementSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const resolveBoardPlacementOriginFx = Effect.fn("resolveBoardPlacementOriginFx")(function* ({
	origin,
	placement,
	size,
}: {
	readonly origin: BoardLocationSchema.Type;
	readonly placement: PlacementSchema.Type;
	readonly size: SizeSchema.Type;
}) {
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

/** Resolves one board-space origin, then plans stack-first nearest placement there. */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	excludedLocations,
	item,
	origin,
	placement,
	quantity,
	runtime,
}: PlanBoardPlacementProps) {
	const config = yield* GameConfigFx;
	const placementOrigin = yield* resolveBoardPlacementOriginFx({
		origin,
		placement,
		size: config.meta.board,
	});
	const boardLocations = readBoardLocationsFn({
		size: config.meta.board,
		space: origin.space,
	});
	const orderedBoardLocations = orderGridLocationsFn({
		locations: boardLocations,
		origin: placementOrigin.position,
	});

	return yield* planScopePlacementFx({
		excludedLocations,
		item,
		locations: orderedBoardLocations,
		origin: placementOrigin.position,
		quantity,
		runtime,
	});
});
