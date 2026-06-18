import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameActionInventorySlotsSwapSchema } from "~/v0/game/engine/model/GameActionInventorySlotsSwapSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
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
	if (
		action.sourceSlotIndex >= save.inventory.slots.length ||
		action.targetSlotIndex >= save.inventory.slots.length
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Inventory slot is outside inventory.",
			),
		);
	}
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
