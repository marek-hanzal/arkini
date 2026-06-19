import { Effect } from "effect";
import { checkCraftStartReadinessFx } from "~/v0/game/craft/checkCraftStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace startCraftFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftStart;
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
		save,
	});

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
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
