import { z } from "zod";
import { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	type GameEffectValidationEntities,
	validateGameDropEffects,
} from "~/config/validation/GameConfigEffectValidation";

export const validateActivationOutput = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	output: z.infer<typeof ActivationOutputSchema>,
	entities: GameEffectValidationEntities,
) => {
	for (const [index, entry] of output.entries()) {
		if (entry.type === "weighted") {
			for (const [entryIndex, weightedEntry] of entry.entries.entries()) {
				if (!entities.hasItem(weightedEntry.itemId)) {
					addIssue(
						ctx,
						[
							...path,
							index,
							"entries",
							entryIndex,
							"itemId",
						],
						`Missing item "${weightedEntry.itemId}".`,
					);
				}
				validateGameDropEffects(
					ctx,
					[
						...path,
						index,
						"entries",
						entryIndex,
						"effects",
					],
					weightedEntry.effects ?? [],
					entities,
				);
			}

			continue;
		}

		if (!entities.hasItem(entry.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${entry.itemId}".`,
			);
		}

		validateGameDropEffects(
			ctx,
			[
				...path,
				index,
				"effects",
			],
			entry.effects ?? [],
			entities,
		);
	}
};
