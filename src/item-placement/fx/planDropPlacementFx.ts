import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";

import { planBoardPlacementFx } from "./planBoardPlacementFx";

interface PlanDropPlacementProps {
	readonly drop: ResolvedOutcome.Item;
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const assertBoardOnlyCapacityFx = Effect.fn("assertBoardOnlyCapacityFx")(function* ({
	drop,
	item,
	origin,
	runtime,
}: {
	readonly drop: ResolvedOutcome.Item;
	readonly item: ItemSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const config = yield* GameConfigFx;
	const size = readBoardSizeFn({
		runtime,
		config,
		space: origin.space,
	});
	const boardSpace = origin.space;
	const occupied = new Set<string>();
	for (const { location } of readGridLocationClaimsFn({
		runtime,
	})) {
		if (
			location.scope === "board" &&
			location.space === boardSpace &&
			location.position.x >= 0 &&
			location.position.x < size.width &&
			location.position.y >= 0 &&
			location.position.y < size.height
		) {
			occupied.add(readGridLocationKeyFn(location));
		}
	}
	const available = size.width * size.height - occupied.size;
	if (available >= drop.quantity) return;

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemUid: item.uid,
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
	origin,
	runtime,
}: PlanDropPlacementProps) {
	const item = yield* resolveItemFx({
		itemUid: drop.itemUid,
	});
	yield* assertBoardOnlyCapacityFx({
		drop,
		item,
		origin,
		runtime,
	});
	const plan = yield* planBoardPlacementFx({
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
