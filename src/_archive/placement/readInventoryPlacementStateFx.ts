import { Effect } from "effect";
import { consumeInventorySlotQuantityFx } from "~/inventory/consumeInventorySlotQuantityFx";
import { checkInventoryItemPlaceReadinessFx } from "~/placement/checkInventoryItemPlaceReadinessFx";
import type {
	InventoryPlacementState,
	PlaceInventoryItemOnBoardProps,
} from "~/placement/InventoryItemOnBoardPlacementTypes";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export const readInventoryPlacementStateFx = Effect.fn("readInventoryPlacementStateFx")(function* (
	props: PlaceInventoryItemOnBoardProps,
) {
	yield* checkInventoryItemPlaceReadinessFx(props);

	const quantity = props.action.quantity ?? 1;
	const nextSave = yield* cloneGameSaveFx({
		save: props.save,
	});
	const consumed = yield* consumeInventorySlotQuantityFx({
		nextSave,
		quantity,
		reason: "inventory-placement",
		runtimeState: "preserve-instance",
		slotIndex: props.action.slotIndex,
	});
	return {
		consumedEvent: consumed.consumedEvent,
		itemId: consumed.itemId,
		liveSlot: consumed.slot,
		nextSave,
		placedCreatedAtMs:
			consumed.slot.createdAtMs ??
			(props.config.items[consumed.itemId]?.effects?.length ? props.nowMs : undefined),
		placementMode: props.action.placementMode ?? "exact",
		quantity,
	} satisfies InventoryPlacementState;
});
