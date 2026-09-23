import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect } from "effect";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";

/** Moves an existing Board identity in the caller's candidate, preserving all owned state and delivery leases. */
export const relocateBoardItemFx = Effect.fn("relocateBoardItemFx")(function* ({
	itemId,
	origin,
	originItemId,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly originItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const item = yield* readBoardRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const config = yield* GameConfigFx;
	const available = readEmptyLocationsFn({
		locations: readBoardLocationsFn({
			size: readBoardSizeFn({
				runtime,
				config,
				space: origin.space,
			}),
			space: origin.space,
		}),
		runtime: {
			...runtime,
			items: runtime.items.filter((candidate) => candidate.id !== item.id),
		},
	});
	const location = orderGridLocationsFn({
		locations: available,
		origin: origin.position,
	})[0];
	if (location === undefined)
		return yield* Effect.fail(
			new PlacementUnavailableError({
				itemId: item.item.id,
				placement: "drop",
				quantity: 1,
				remainingQuantity: 1,
				reason: PlacementUnavailableError.Reason.BoardFull,
			}),
		);
	const moved = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location,
		},
	});
	return {
		runtime: {
			...runtime,
			items: runtime.items.map((candidate) => (candidate.id === item.id ? moved : candidate)),
		},
		events: [
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: item.id,
				canonicalItemId: item.item.id,
				originItemId,
				previousLocation: item.location,
				location,
			},
		] satisfies GameEventSchema.Type[],
	};
});
