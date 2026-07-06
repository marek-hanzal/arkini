import { Effect } from "effect";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { readInventoryStackCapacityFx } from "~/inventory/readInventoryStackCapacityFx";
import { placeGameSaveInventoryInstanceFx } from "~/placement/placeGameSaveInventoryInstanceFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";

export namespace placeBoardItemInInventoryFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		item: GameSaveBoardItem;
		mode: "preserve-instance" | "stack-copy";
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"] &
			Extract<
				GameEvent,
				{
					type: "item.created";
				}
			>["reason"];
		save: GameSave;
	}
}

const assertInventoryStorageAllowedFx = Effect.fn(
	"placeBoardItemInInventoryFx.assertInventoryStorageAllowedFx",
)(function* ({ config, itemId }: { config: GameConfig; itemId: string }) {
	const itemDefinition = yield* readGameConfigItemDefinitionFx({
		config,
		itemId,
	});
	if (
		isItemStorageAllowed({
			config,
			itemId,
			location: "inventory",
		})
	) {
		return itemDefinition;
	}

	return yield* Effect.fail(
		GameEngineError.placementFailed(
			"storage:inventory-forbidden",
			`Item "${itemId}" cannot be placed in inventory.`,
		),
	);
});

const pushBoardItemInventoryTransferEventsFx = Effect.fn(
	"placeBoardItemInInventoryFx.pushBoardItemInventoryTransferEventsFx",
)(function* ({
	events,
	item,
	placementEvents,
	reason,
}: {
	events: GameEvent[];
	item: GameSaveBoardItem;
	placementEvents: readonly GameEvent[];
	reason: placeBoardItemInInventoryFx.Props["reason"];
}) {
	events.push(
		yield* createBoardItemConsumedEventFx({
			itemId: item.itemId,
			itemInstanceId: item.id,
			nextQuantity: 0,
			previousQuantity: readGameSaveBoardItemQuantity(item),
			quantity: readGameSaveBoardItemQuantity(item),
			reason,
		}),
	);
	events.push(...placementEvents);
});

const placePreservedBoardItemInInventoryFx = Effect.fn(
	"placeBoardItemInInventoryFx.placePreservedBoardItemInInventoryFx",
)(function* ({ config, events, item, reason, save }: placeBoardItemInInventoryFx.Props) {
	yield* assertInventoryStorageAllowedFx({
		config,
		itemId: item.itemId,
	});
	const placementEvents: GameEvent[] = [];
	yield* placeGameSaveInventoryInstanceFx({
		config,
		createdAtMs: item.createdAtMs,
		events: placementEvents,
		itemId: item.itemId,
		itemInstanceId: item.id,
		reason,
		slots: save.inventory.slots,
	});
	yield* pushBoardItemInventoryTransferEventsFx({
		events,
		item,
		placementEvents,
		reason,
	});
	yield* removeBoardItemFromSaveFx({
		itemInstanceId: item.id,
		runtimeState: "preserve",
		save,
	});
});

const placeStackCopiedBoardItemInInventoryFx = Effect.fn(
	"placeBoardItemInInventoryFx.placeStackCopiedBoardItemInInventoryFx",
)(function* ({ config, events, item, reason, save }: placeBoardItemInInventoryFx.Props) {
	const quantity = readGameSaveBoardItemQuantity(item);
	const itemDefinition = yield* assertInventoryStorageAllowedFx({
		config,
		itemId: item.itemId,
	});
	const inventoryCapacity = yield* readInventoryStackCapacityFx({
		itemId: item.itemId,
		maxStackSize: itemDefinition.maxStackSize,
		slots: save.inventory.slots,
	});
	if (inventoryCapacity < quantity) return false;

	const placementEvents: GameEvent[] = [];
	const placed = yield* placeGameSaveInventoryRemainderFx({
		createdAtMs: item.createdAtMs,
		events: placementEvents,
		item: {
			itemId: item.itemId,
			originItemInstanceId: item.id,
			quantity,
			reason,
		},
		maxStackSize: itemDefinition.maxStackSize,
		remainingQuantity: quantity,
		slots: save.inventory.slots,
	});
	if (!placed) return false;

	yield* pushBoardItemInventoryTransferEventsFx({
		events,
		item,
		placementEvents,
		reason,
	});
	yield* removeBoardItemFromSaveFx({
		itemInstanceId: item.id,
		runtimeState: "remove",
		save,
	});
	return true;
});

export const placeBoardItemInInventoryFx = Effect.fn("placeBoardItemInInventoryFx")(function* (
	props: placeBoardItemInInventoryFx.Props,
) {
	if (props.mode === "preserve-instance") {
		yield* placePreservedBoardItemInInventoryFx(props);
		return true;
	}

	return yield* placeStackCopiedBoardItemInInventoryFx(props);
});
