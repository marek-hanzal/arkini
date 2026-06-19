import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { placeGameSaveInventoryRemainderFx } from "~/v0/game/placement/placeGameSaveInventoryRemainderFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import type { GameSaveItemPlacementResult } from "~/v0/game/placement/GameSaveItemPlacementResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeGameSaveInventoryItemsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		items: GameSaveItemPlacementRequest[];
		nowMs: number;
	}
}

export const placeGameSaveInventoryItemsFx = Effect.fn("placeGameSaveInventoryItemsFx")(function* ({
	config,
	save,
	items,
	nowMs,
}: placeGameSaveInventoryItemsFx.Props) {
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	for (const item of items) {
		const itemDefinition = config.items[item.itemId];
		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
			);
		}

		if (
			!isItemStorageAllowed({
				config,
				itemId: item.itemId,
				location: "inventory",
			})
		) {
			return yield* Effect.fail(
				GameEngineError.placementFailed(
					"storage:inventory-forbidden",
					`Item "${item.itemId}" cannot be placed in inventory.`,
				),
			);
		}

		const placed = yield* placeGameSaveInventoryRemainderFx({
			events,
			item,
			maxStackSize: itemDefinition.maxStackSize,
			remainingQuantity: item.quantity,
			slots: nextSave.inventory.slots,
		});

		if (!placed) {
			return yield* Effect.fail(
				GameEngineError.placementFailed("inventory:full", "Inventory is full."),
			);
		}
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		save: nextSave,
		type: "placed",
	} satisfies GameSaveItemPlacementResult;
});
