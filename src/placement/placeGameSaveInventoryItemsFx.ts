import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import type { GameSaveItemPlacementResult } from "~/placement/GameSaveItemPlacementResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
		const itemDefinition = yield* readGameConfigItemDefinitionFx({
			config,
			itemId: item.itemId,
		});

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
			createdAtMs: item.createdAtMs ?? (itemDefinition.effects?.length ? nowMs : undefined),
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
