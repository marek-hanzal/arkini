import { Effect } from "effect";
import { checkCraftInputStoreReadinessFx } from "~/craft/checkCraftInputStoreReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameActionCraftInputStore } from "~/action/GameActionCraftInputStore";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace storeCraftInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftInputStore;
		nowMs: number;
	}
}

export const storeCraftInputFx = Effect.fn("storeCraftInputFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: storeCraftInputFx.Props) {
	const checked = yield* checkCraftInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	yield* consumeResolvedInputRefFx({
		events,
		nextSave,
		reason: "craft-input-store",
		ref: checked.resolvedRef,
	});

	const craftInputState = (nextSave.craftInputs[action.targetItemInstanceId] ??= {
		items: {},
	});
	craftInputState.items[checked.resolvedRef.itemId] = checked.nextQuantity;
	nextSave.updatedAtMs = nowMs;

	events.push({
		itemId: checked.resolvedRef.itemId,
		nextQuantity: checked.nextQuantity,
		previousQuantity: checked.previousQuantity,
		quantity: checked.resolvedRef.quantity,
		recipeId: checked.target.recipeId,
		atMs: nowMs,
		targetItemInstanceId: action.targetItemInstanceId,
		type: "craft_input.stored",
	});

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
