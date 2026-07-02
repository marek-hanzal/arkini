import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import { checkInventorySlotsSwapReadinessFx } from "~/inventory/logic/checkInventorySlotsSwapReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameActionInventorySlotsSwapSchema } from "~/action/GameActionInventorySlotsSwapSchema";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
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
		return {
			events: [],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				config,
				nowMs,
				save,
			}),
			save,
		} satisfies GameEngineResult;
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const source = nextSave.inventory.slots[action.sourceSlotIndex] ?? null;
	nextSave.inventory.slots[action.sourceSlotIndex] =
		nextSave.inventory.slots[action.targetSlotIndex] ?? null;
	nextSave.inventory.slots[action.targetSlotIndex] = source;
	nextSave.updatedAtMs = nowMs;

	return {
		events: [],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
