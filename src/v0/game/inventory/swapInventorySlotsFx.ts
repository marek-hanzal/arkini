import { Effect } from "effect";
import { checkInventorySlotsSwapReadinessFx } from "~/v0/game/inventory/checkInventorySlotsSwapReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameActionInventorySlotsSwapSchema } from "~/v0/game/engine/model/GameActionInventorySlotsSwapSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace swapInventorySlotsFx {
	export interface Props {
		action: GameActionInventorySlotsSwapSchema.Type;
		save: GameSave;
		nowMs: number;
	}
}

export const swapInventorySlotsFx = Effect.fn("swapInventorySlotsFx")(function* ({
	action,
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
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
