import { Effect } from "effect";
import { checkCraftInputStoreReadinessFx } from "~/craft/checkCraftInputStoreReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { readCraftStoredInputsReadyFx } from "~/craft/readCraftStoredInputsReadyFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { startCraftFx } from "~/craft/startCraftFx";
import type { GameConfig } from "~/config/GameConfigTypes";
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

	const storedInputsReady = yield* readCraftStoredInputsReadyFx({
		inputs: checked.target.recipe.inputs,
		save: nextSave,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	const storedResult = {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
	if (!storedInputsReady) return storedResult;

	const startEither = yield* Effect.either(
		startCraftFx({
			action: {
				recipeId: checked.target.recipeId,
				targetItemInstanceId: action.targetItemInstanceId,
				type: "craft.start",
			},
			config,
			nowMs,
			save: nextSave,
		}),
	);
	if (startEither._tag === "Left") {
		const error = startEither.left;
		if (error._tag === "GameActionRejected") return storedResult;
		return yield* Effect.fail(error);
	}

	return {
		events: [
			...events,
			...startEither.right.events,
		],
		nextWakeAtMs: startEither.right.nextWakeAtMs,
		save: startEither.right.save,
	} satisfies GameEngineResult;
});
