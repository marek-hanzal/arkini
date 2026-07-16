import { z } from "zod";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import type {
	CommonGameLineEffect,
	GameEffectValidationEntities,
} from "~/config/validation/GameConfigEffectValidationTypes";
import { validateCommonGameLineEffect } from "~/config/validation/validateCommonGameLineEffect";

export const validateGameLineEffects = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	effects: readonly CommonGameLineEffect[],
	entities: GameEffectValidationEntities,
) => {
	for (const [effectIndex, effect] of effects.entries()) {
		validateCommonGameLineEffect({
			ctx,
			effect,
			effectIndex,
			entities,
			path,
		});
	}
};
