import { Effect } from "effect";
import { autoFillCraftInputsFx } from "~/v0/game/craft/autoFillCraftInputsFx";
import { checkCraftStartReadinessFx } from "~/v0/game/craft/checkCraftStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readCraftInputQuantitiesFx } from "~/v0/game/craft/readCraftInputQuantitiesFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
	inputs: readonly GameConfig["craftRecipes"][string]["inputs"][number][];
	save: GameSave;
	targetItemInstanceId: string;
}) {
	const storedInputs = yield* readCraftInputQuantitiesFx({
		save,
		targetItemInstanceId,
	});
	return inputs.every((input) => (storedInputs.get(input.itemId) ?? 0) >= input.quantity);
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
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	}

	delete nextSave.craftInputs[action.targetItemInstanceId];
	const jobId = yield* createGameJobIdFx();
	const completesAtMs = nowMs + checked.recipe.durationMs;
	nextSave.craftJobs[jobId] = {
		completesAtMs,
		id: jobId,
		recipeId: action.recipeId,
		startedAtMs: nowMs,
		targetItemInstanceId: action.targetItemInstanceId,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...events,
			{
				completesAtMs,
				jobId,
				recipeId: action.recipeId,
				startedAtMs: nowMs,
				targetItemInstanceId: action.targetItemInstanceId,
				type: "craft.started" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
