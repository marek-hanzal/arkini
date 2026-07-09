import { Effect } from "effect";
import { assertBoardCellInsideBoundsFx } from "~/board/assertBoardCellInsideBoundsFx";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readGameSaveInventorySlotQuantity } from "~/inventory/model/GameSaveInventorySlot";
import type {
	InventoryItemPlaceReadinessProps,
	InventoryPlacementSlot,
} from "~/placement/InventoryItemPlaceReadinessTypes";
import { readSaveAfterInventoryRemovalPreviewFx } from "~/placement/readSaveAfterInventoryRemovalPreviewFx";

export const assertInventoryPlacementTargetCellFx = Effect.fn(
	"assertInventoryPlacementTargetCellFx",
)(function* ({ action, config }: InventoryItemPlaceReadinessProps) {
	yield* assertBoardCellInsideBoundsFx({
		config,
		x: action.x,
		y: action.y,
	});
});

const readInventoryPlacementSlotFx = Effect.fn("readInventoryPlacementSlotFx")(function* ({
	action,
	save,
}: InventoryItemPlaceReadinessProps) {
	const slot = save.inventory.slots[action.slotIndex];
	if (slot) return slot;

	return yield* Effect.fail(
		GameEngineError.actionRejected("input_unavailable", "Inventory slot is empty."),
	);
});

const assertInventoryPlacementStorageFx = Effect.fn("assertInventoryPlacementStorageFx")(
	function* ({
		config,
		slot,
	}: {
		config: InventoryItemPlaceReadinessProps["config"];
		slot: InventoryPlacementSlot;
	}) {
		if (
			isItemStorageAllowed({
				config,
				itemId: slot.itemId,
				location: "board",
			})
		) {
			return;
		}

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"storage_restricted",
				`Item "${slot.itemId}" cannot be placed on board.`,
			),
		);
	},
);

const readInventoryPlacementQuantityFx = Effect.fn("readInventoryPlacementQuantityFx")(function* ({
	action,
	slot,
}: {
	action: InventoryItemPlaceReadinessProps["action"];
	slot: InventoryPlacementSlot;
}) {
	const quantity = action.quantity ?? 1;
	const slotQuantity = readGameSaveInventorySlotQuantity(slot);
	if (quantity <= slotQuantity) return quantity;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"input_unavailable",
			`Inventory slot has ${slotQuantity} item(s), cannot place ${quantity}.`,
		),
	);
});

export const readInventoryPlacementDraftFx = Effect.fn("readInventoryPlacementDraftFx")(function* (
	props: InventoryItemPlaceReadinessProps,
) {
	const slot = yield* readInventoryPlacementSlotFx(props);
	const itemDefinition = yield* readGameConfigItemDefinitionFx({
		config: props.config,
		itemId: slot.itemId,
	});
	yield* assertInventoryPlacementStorageFx({
		config: props.config,
		slot,
	});
	const quantity = yield* readInventoryPlacementQuantityFx({
		action: props.action,
		slot,
	});

	return {
		itemDefinition,
		placementMode: props.action.placementMode ?? "exact",
		quantity,
		saveAfterInventoryRemoval: yield* readSaveAfterInventoryRemovalPreviewFx({
			quantity,
			save: props.save,
			slotIndex: props.action.slotIndex,
		}),
		slot,
	};
});
