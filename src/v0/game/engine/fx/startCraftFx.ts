import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/engine/fx/consumeActivationInputsFx";
import { createGameJobIdFx } from "~/v0/game/engine/fx/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/engine/model/GameActionCraftStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameRequirement } from "~/v0/game/engine/model/GameRequirement";
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
	const recipe = config.craftRecipes[action.recipeId];
	if (!recipe) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft recipe "${action.recipeId}".`),
		);
	}

	const passiveRequirements: GameRequirement[] = [];
	const storedRequirements: GameRequirement[] = [];
	for (const requirement of recipe.requirements) {
		yield* match(requirement)
			.with(
				{
					type: "passive",
				},
				(passiveRequirement) => {
					passiveRequirements.push(passiveRequirement);
					return Effect.void;
				},
			)
			.with(
				{
					type: "stored",
				},
				(storedRequirement) => {
					storedRequirements.push(storedRequirement);
					return Effect.void;
				},
			)
			.exhaustive();
	}

	yield* checkGameRequirementsFx({
		config,
		requirements: passiveRequirements,
		save,
	});

	const consumedInputs = yield* consumeActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: recipe.inputs,
		nowMs,
		reason: "craft-input",
		save,
	});
	const consumedRequirements = yield* consumeActivationInputsFx({
		inputRefs: action.requirementRefs,
		inputs: storedRequirements.map((requirement) => ({
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
	const completesAtMs = nowMs + recipe.durationMs;
	nextSave.craftJobs[jobId] = {
		completesAtMs,
		id: jobId,
		recipeId: action.recipeId,
		returnItems: storedRequirements.map((requirement) => ({
			itemId: requirement.itemId,
			quantity: requirement.quantity,
		})),
		startedAtMs: nowMs,
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
				type: "craft.started" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
