import { Effect } from "effect";
import { checkActivationInputsFx } from "~/v0/game/engine/fx/checkActivationInputsFx";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { splitCraftRequirementsFx } from "~/v0/game/engine/fx/splitCraftRequirementsFx";
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
	const recipe = config.craftRecipes[action.recipeId];
	if (!recipe) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft recipe "${action.recipeId}".`),
		);
	}

	const requirements = yield* splitCraftRequirementsFx({
		requirements: recipe.requirements,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: requirements.passiveRequirements,
		save,
	});
	yield* checkActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: recipe.inputs,
		save,
	});
	yield* checkActivationInputsFx({
		inputRefs: action.requirementRefs,
		inputs: requirements.storedRequirements.map((requirement) => ({
			consume: true,
			itemId: requirement.itemId,
			quantity: requirement.quantity,
		})),
		save,
	});

	return {
		recipe,
		requirements,
	};
});
