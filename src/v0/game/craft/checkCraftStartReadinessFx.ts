import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readCraftInputQuantitiesFx } from "~/v0/game/craft/readCraftInputQuantitiesFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/engine/fx/readStoredRequirementQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/engine/model/GameActionCraftStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkCraftStartReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftStart;
	}
}

export const checkCraftStartReadinessFx = Effect.fn("checkCraftStartReadinessFx")(function* ({
	config,
	save,
	action,
}: checkCraftStartReadinessFx.Props) {
	const target = yield* readCraftBoardItemFx({
		config,
		recipeId: action.recipeId,
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});

	const runningCraftJob = Object.values(save.craftJobs).find(
		(job) => job.targetItemInstanceId === action.targetItemInstanceId,
	);
	if (runningCraftJob) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"craft_in_progress",
				`Craft target "${action.targetItemInstanceId}" already has running craft job "${runningCraftJob.id}".`,
			),
		);
	}

	const storedInputs = yield* readCraftInputQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	for (const input of target.recipe.inputs) {
		const storedQuantity = storedInputs.get(input.itemId) ?? 0;
		if (storedQuantity < input.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_unavailable",
					`Craft input "${input.itemId}" is incomplete (${storedQuantity}/${input.quantity}).`,
				),
			);
		}
	}

	const storedRequirementItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: target.recipe.requirements,
		save,
		storedItems: storedRequirementItems,
	});

	return {
		recipe: target.recipe,
		targetItem: target.targetItem,
	};
});
