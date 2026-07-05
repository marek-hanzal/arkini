import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import { formatIssuePath } from "~/config/validation/GameConfigValidationFormatting";
import { readConfigEffects } from "~/config/validation/GameConfigValidationReaders";

export const validateConfigEffects = (ctx: z.RefinementCtx, config: GameConfig) => {
	const effectIds = new Map<string, GameConfigIssuePath>();
	const grantIds = new Map<string, GameConfigIssuePath>();

	for (const { effect, path } of readConfigEffects(config)) {
		const previousEffectPath = effectIds.get(effect.id);
		if (previousEffectPath) {
			addIssue(
				ctx,
				[
					...path,
					"id",
				],
				`Duplicate effect id "${effect.id}" already defined at ${formatIssuePath(previousEffectPath)}.`,
			);
		} else {
			effectIds.set(effect.id, path);
		}

		for (const [grantIndex, grant] of effect.grants.entries()) {
			const grantPath: GameConfigIssuePath = [
				...path,
				"grants",
				grantIndex,
				"id",
			];
			const previousGrantPath = grantIds.get(grant.id);
			if (previousGrantPath) {
				addIssue(
					ctx,
					grantPath,
					`Duplicate grant id "${grant.id}" already defined at ${formatIssuePath(previousGrantPath)}.`,
				);
				continue;
			}
			grantIds.set(grant.id, grantPath);
		}
	}
};
