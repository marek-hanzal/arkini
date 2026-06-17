import { Effect } from "effect";
import { checkCraftStartReadinessFx } from "~/v0/game/engine/fx/checkCraftStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/engine/fx/consumeActivationInputsFx";
import { createGameJobIdFx } from "~/v0/game/engine/fx/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/engine/model/GameActionCraftStart";
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
	const consumedInputs = yield* consumeActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: checked.recipe.inputs,
		nowMs,
		reason: "craft-input",
		save,
	});
	const consumedRequirements = yield* consumeActivationInputsFx({
		inputRefs: action.requirementRefs,
		inputs: checked.requirements.storedRequirements.map((requirement) => ({
			consume: true,
			itemId: requirement.itemId,
			quantity: requirement.quantity,
		})),
		nowMs,
		reason: "craft-requirement",
		save: consumedInputs.save,
	});

	const nextSave = yield* cloneGameSaveFx({
		save: consumedRequirements.save,
	});
	const jobId = yield* createGameJobIdFx({
		save: nextSave,
	});
	const completesAtMs = nowMs + checked.recipe.durationMs;
	nextSave.craftJobs[jobId] = {
		completesAtMs,
		id: jobId,
		recipeId: action.recipeId,
		returnItems: checked.requirements.storedRequirements.map((requirement) => ({
			itemId: requirement.itemId,
			quantity: requirement.quantity,
		})),
		startedAtMs: nowMs,
		targetItemInstanceId: action.targetItemInstanceId,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumedInputs.events,
			...consumedRequirements.events,
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
