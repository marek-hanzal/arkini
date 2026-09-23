import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect, Random } from "effect";
import { match } from "ts-pattern";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";

interface PlanBoardPlacementProps {
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
		.with(PlacementSchema.enum.Drop, () => Effect.succeed(origin.position))
		.with(PlacementSchema.enum.Random, () =>
			Random.nextIntBetween(0, size.width * size.height, {
				halfOpen: true,
			}).pipe(
				Effect.map(
					(index) =>
						({
							x: index % size.width,
							y: Math.floor(index / size.width),
						}) satisfies PositionSchema.Type,
				),
			),
		)
		.exhaustive();
});

/** Plans single-item placement in one Board space around its physical or randomized origin. */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	item,
	origin,
	placement,
	quantity,
	runtime,
}: PlanBoardPlacementProps) {
	const config = yield* GameConfigFx;
	const size = readBoardSizeFn({
		runtime,
		config,
		space: origin.space,
	});
	const placementOrigin = yield* resolveBoardPlacementOriginFx({
		origin,
		placement,
		size,
	});
	const boardLocations = readBoardLocationsFn({
		size,
		space: origin.space,
	});
	const locations = orderGridLocationsFn({
		locations: boardLocations,
		origin: placementOrigin,
	});

	const emptyLocations = readEmptyLocationsFn({
		locations,
		runtime,
	});
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: emptyLocations,
		quantity,
	});

	return {
		spawn,
	} satisfies PlacementPlan;
});
