import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeGameSaveInventoryInstanceFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		itemId: string;
		itemInstanceId: string;
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

		slots[slotIndex] = {
			id: itemInstanceId,
			itemId,
			kind: "instance",
		};
		events.push({
			itemId,
			originItemInstanceId: itemInstanceId,
			reason,
			to: {
				kind: "inventory",
				nextQuantity: 1,
				previousQuantity: 0,
				quantity: 1,
				slotIndex,
			},
			type: "item.created",
		});
	},
);
