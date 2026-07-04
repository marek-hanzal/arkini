import { Effect } from "effect";
import { autoFillCraftInputsFx } from "~/craft/autoFillCraftInputsFx";
import { checkCraftStartReadinessFx } from "~/craft/checkCraftStartReadinessFx";
import { checkCraftStartRuntimeConstraintsFx } from "~/craft/checkCraftStartRuntimeConstraintsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameJobIdFx } from "~/job/createGameJobIdFx";
import { readCraftStoredInputsReadyFx } from "~/craft/readCraftStoredInputsReadyFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { readCraftJobEffectiveTimingFx } from "~/craft/readCraftJobEffectiveTimingFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionCraftStartSchema } from "~/action/GameActionCraftStartSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace startCraftFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftStartSchema.Type;
		nowMs: number;
	}
}

export const startCraftFx = Effect.fn("startCraftFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: startCraftFx.Props) {
	const checked = yield* checkCraftStartReadinessFx({
		action,
		config,
		nowMs,
		save,
	});

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const inputsReady = yield* autoFillCraftInputsFx({
		events,
		inputs: checked.recipe.inputs,
		nextSave,
		nowMs,
		recipeId: action.recipeId,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	const storedInputsReady =
		inputsReady ||
		(yield* readCraftStoredInputsReadyFx({
			inputs: checked.recipe.inputs,
			save: nextSave,
			targetItemInstanceId: action.targetItemInstanceId,
		}));
	if (!storedInputsReady) {
		if (events.length > 0) nextSave.updatedAtMs = nowMs;
		return yield* createGameEngineResultFx({
			config,
			events,
			nowMs,
			save: nextSave,
		});
	}

	yield* checkCraftStartRuntimeConstraintsFx({
		config,
		nowMs,
		recipe: checked.recipe,
		save: nextSave,
		targetItem: checked.targetItem,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	delete nextSave.craftInputs[action.targetItemInstanceId];
	const jobId = yield* createGameJobIdFx();
	const timing = yield* readCraftJobEffectiveTimingFx({
		recipe: checked.recipe,
		save: nextSave,
		startAtMs: nowMs,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	nextSave.craftJobs[jobId] = {
		readyAtMs: timing.readyAtMs,
		id: jobId,
		recipeId: action.recipeId,
		startAtMs: timing.startAtMs,
		targetItemInstanceId: action.targetItemInstanceId,
	};
	nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: [
			...events,
			{
				atMs: nowMs,
				readyAtMs: timing.readyAtMs,
				jobId,
				recipeId: action.recipeId,
				startAtMs: timing.startAtMs,
				targetItemInstanceId: action.targetItemInstanceId,
				type: "craft.started" as const,
			},
		],
		nowMs,
		save: nextSave,
	});
});
