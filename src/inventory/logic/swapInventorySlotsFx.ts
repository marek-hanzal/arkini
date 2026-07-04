import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkInventorySlotsSwapReadinessFx } from "~/inventory/logic/checkInventorySlotsSwapReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameActionInventorySlotsSwapSchema } from "~/action/GameActionInventorySlotsSwapSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace swapInventorySlotsFx {
	export interface Props {
		action: GameActionInventorySlotsSwapSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const swapInventorySlotsFx = Effect.fn("swapInventorySlotsFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: swapInventorySlotsFx.Props) {
	yield* checkInventorySlotsSwapReadinessFx({
		action,
		save,
	});
	if (action.sourceSlotIndex === action.targetSlotIndex) {
		return yield* createGameEngineResultFx({
			config,
			events: [],
			nowMs,
			save,
		});
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const source = nextSave.inventory.slots[action.sourceSlotIndex] ?? null;
	nextSave.inventory.slots[action.sourceSlotIndex] =
		nextSave.inventory.slots[action.targetSlotIndex] ?? null;
	nextSave.inventory.slots[action.targetSlotIndex] = source;
	nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: [],
		nowMs,
		save: nextSave,
	});
});
