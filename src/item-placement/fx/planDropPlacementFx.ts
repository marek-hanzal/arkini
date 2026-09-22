import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { dropFx } from "~/production-output/fx/dropFx";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";

import { planBoardPlacementFx } from "./planBoardPlacementFx";

interface PlanDropPlacementProps {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const assertBoardOnlyCapacityFx = Effect.fn("assertBoardOnlyCapacityFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	runtime,
}: {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (item.maxStackSize !== 1) return;

	const config = yield* GameConfigFx;
	const boardSpace = origin.space;
	const occupied = new Set<string>();
	for (const location of [
		...readGridLocationClaimsFn({
			runtime,
		}).map((claim) => claim.location),
		...(excludedLocations ?? []),
	]) {
		if (
			location.scope === "board" &&
			location.space === boardSpace &&
			location.position.x >= 0 &&
			location.position.x < config.meta.board.width &&
			location.position.y >= 0 &&
			location.position.y < config.meta.board.height
		) {
			occupied.add(readGridLocationKeyFn(location));
		}
	}
	const available = config.meta.board.width * config.meta.board.height - occupied.size;
	if (available >= drop.quantity) return;

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: item.id,
			placement: drop.placement,
			quantity: drop.quantity,
			reason: PlacementUnavailableError.Reason.BoardFull,
			remainingQuantity: drop.quantity - available,
		}),
	);
});

/** Plans one complete all-or-nothing board drop. */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	excludedLocations,
	origin,
	runtime,
}: PlanDropPlacementProps) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	yield* assertBoardOnlyCapacityFx({
		drop,
		excludedLocations,
		item,
		origin,
		runtime,
	});
	const plan = yield* planBoardPlacementFx({
		excludedLocations,
		item,
		origin,
		placement: drop.placement,
		quantity: drop.quantity,
		runtime,
	});
	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan,
		quantity: drop.quantity,
		reason: PlacementUnavailableError.Reason.BoardFull,
	});
});
