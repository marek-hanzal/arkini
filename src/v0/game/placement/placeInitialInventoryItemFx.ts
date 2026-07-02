import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { isGameSaveInventoryStack } from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeInitialInventoryItemFx {
	export interface Props {
		config: GameConfig;
		inventorySlots: GameSaveInventorySlot[];
		itemId: string;
		nowMs: number;
		quantity: number;
	}
}

export const placeInitialInventoryItemFx = Effect.fn("placeInitialInventoryItemFx")(function* ({
	config,
	inventorySlots,
	itemId,
	nowMs,
	quantity,
}: placeInitialInventoryItemFx.Props) {
	const item = config.items[itemId];

	if (!item) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${itemId}".`),
		);
	}

	if (
		!isItemStorageAllowed({
			config,
			itemId,
			location: "inventory",
		})
	) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(`Starting inventory cannot contain "${itemId}".`),
		);
	}

	let remainingQuantity = quantity;

	for (const slot of inventorySlots) {
		if (
			!isGameSaveInventoryStack(slot) ||
			slot.itemId !== itemId ||
			slot.quantity >= item.maxStackSize
		) {
			continue;
		}

		const placedQuantity = Math.min(item.maxStackSize - slot.quantity, remainingQuantity);
		slot.quantity += placedQuantity;
		remainingQuantity -= placedQuantity;

		if (remainingQuantity === 0) {
			return;
		}
	}

	for (let slotIndex = 0; slotIndex < inventorySlots.length; slotIndex += 1) {
		if (inventorySlots[slotIndex]) {
			continue;
		}

		const placedQuantity = Math.min(item.maxStackSize, remainingQuantity);
		inventorySlots[slotIndex] = {
			...(item.effects?.length
				? {
						createdAtMs: nowMs,
					}
				: {}),
			itemId,
			quantity: placedQuantity,
		};
		remainingQuantity -= placedQuantity;

		if (remainingQuantity === 0) {
			return;
		}
	}

	return yield* Effect.fail(
		GameEngineError.saveInvalid(`Starting inventory cannot fit ${quantity} of "${itemId}".`),
	);
});
