import { Effect } from "effect";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { readSingleItemInventoryStorageAllowed } from "~/placement/readSinglePlacementStorageAllowed";
import type { SingleItemPlacementScope } from "~/placement/SingleGameSaveItemPlacementTypes";

export const placeSingleInventoryRemainderFx = Effect.fn("placeSingleInventoryRemainderFx")(
	function* ({
		remainingQuantity,
		scope,
	}: {
		remainingQuantity: number;
		scope: SingleItemPlacementScope;
	}) {
		if (!readSingleItemInventoryStorageAllowed(scope)) return remainingQuantity === 0;

		return yield* placeGameSaveInventoryRemainderFx({
			createdAtMs: scope.createdAtMs,
			events: scope.events,
			item: scope.item,
			maxStackSize: scope.itemDefinition.maxStackSize,
			remainingQuantity,
			slots: scope.save.inventory.slots,
		});
	},
);
