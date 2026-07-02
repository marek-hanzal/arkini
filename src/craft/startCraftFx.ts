import { Effect } from "effect";
import { autoFillCraftInputsFx } from "~/craft/autoFillCraftInputsFx";
import { checkCraftStartReadinessFx } from "~/craft/checkCraftStartReadinessFx";
import { checkCraftStartRuntimeConstraintsFx } from "~/craft/checkCraftStartRuntimeConstraintsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameJobIdFx } from "~/job/createGameJobIdFx";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { readCraftJobEffectiveTimingFx } from "~/craft/readCraftJobEffectiveTimingFx";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameActionCraftStart } from "~/action/GameActionCraftStart";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace startCraftFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftStart;
		nowMs: number;
	}
}

const readCraftStoredInputsReadyFx = Effect.fn("readCraftStoredInputsReadyFx")(function* ({
	inputs,
	save,
	targetItemInstanceId,
}: {
	inputs: readonly GameCraftRecipeDefinition["inputs"][number][];
	save: GameSave;
	targetItemInstanceId: string;
}) {
	const storedInputs = yield* readCraftInputQuantitiesFx({
		save,
		targetItemInstanceId,
	});
	return inputs.every(
		(input) =>
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}) >= input.quantity,
	);
});

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
		return {
			events,
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				config,
				nowMs,
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
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

	return {
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
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
