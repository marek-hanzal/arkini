import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import { writeInventorySlotFx } from "~/inventory/writeInventorySlotFx";
import { pushInventoryItemCreatedEventFx } from "~/placement/pushInventoryItemCreatedEventFx";

export namespace placeGameSaveInventoryInstanceFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		itemId: string;
		itemInstanceId: string;
		createdAtMs?: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.created";
			}
		>["reason"];
		slots: GameSaveInventorySlot[];
	}
}

export const placeGameSaveInventoryInstanceFx = Effect.fn("placeGameSaveInventoryInstanceFx")(
	function* ({
		config,
		events,
		itemId,
		itemInstanceId,
		createdAtMs,
		reason,
		slots,
	}: placeGameSaveInventoryInstanceFx.Props) {
		if (
			!isItemStorageAllowed({
				config,
				itemId,
				location: "inventory",
			})
		) {
			return yield* Effect.fail(
				GameEngineError.placementFailed(
					"storage:inventory-forbidden",
					`Item "${itemId}" cannot be placed in inventory.`,
				),
			);
		}

		const slotIndex = slots.findIndex((slot) => !slot);
		if (slotIndex === -1) {
			return yield* Effect.fail(
				GameEngineError.placementFailed("inventory:full", "Inventory is full."),
			);
		}

		yield* writeInventorySlotFx({
			slot: {
				...(createdAtMs !== undefined
					? {
							createdAtMs,
						}
					: {}),
				id: itemInstanceId,
				itemId,
				kind: "instance",
			},
			slotIndex,
			slots,
		});
		yield* pushInventoryItemCreatedEventFx({
			events,
			itemId,
			nextQuantity: 1,
			originItemInstanceId: itemInstanceId,
			previousQuantity: 0,
			quantity: 1,
			reason,
			slotIndex,
		});
	},
);
