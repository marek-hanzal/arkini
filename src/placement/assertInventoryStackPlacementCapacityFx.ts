import { Effect } from "effect";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readInventoryStackCapacityFx } from "~/inventory/readInventoryStackCapacityFx";
import type {
	InventoryItemPlaceReadinessProps,
	InventoryPlacementDraft,
} from "~/placement/InventoryItemPlaceReadinessTypes";
import { readBoardPlacementBlockReasonFx } from "~/placement/readBoardPlacementCapacityFx";

export const assertInventoryStackPlacementCapacityFx = Effect.fn(
	"assertInventoryStackPlacementCapacityFx",
)(function* ({
	boardCapacity,
	draft,
	props,
}: {
	boardCapacity: number;
	draft: InventoryPlacementDraft;
	props: InventoryItemPlaceReadinessProps;
}) {
	if (boardCapacity === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				yield* readBoardPlacementBlockReasonFx({
					config: props.config,
					itemId: draft.slot.itemId,
					save: props.save,
				}),
				"No board placement target available.",
			),
		);
	}

	const inventoryCapacity = yield* readInventoryStackCapacityFx({
		itemId: draft.slot.itemId,
		maxStackSize: draft.itemDefinition.maxStackSize,
		slots: draft.saveAfterInventoryRemoval.inventory.slots,
	});
	if (draft.quantity <= boardCapacity + inventoryCapacity) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("inventory:full", "No placement target available."),
	);
});
