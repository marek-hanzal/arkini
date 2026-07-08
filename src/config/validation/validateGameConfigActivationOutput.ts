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
	for (const [outputSetIndex, outputSet] of output.entries()) {
		for (const [index, entry] of outputSet.entries.entries()) {
			const entryPath = [
				...path,
				outputSetIndex,
				"entries",
				index,
			] satisfies GameConfigIssuePath;
			if (entry.type === "weighted") {
				for (const [entryIndex, weightedEntry] of entry.entries.entries()) {
					if (!entities.hasItem(weightedEntry.itemId)) {
						addIssue(
							ctx,
							[
								...entryPath,
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
							...entryPath,
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
						...entryPath,
						"itemId",
					],
					`Missing item "${entry.itemId}".`,
				);
			}

			validateGameDropEffects(
				ctx,
				[
					...entryPath,
					"effects",
				],
				entry.effects ?? [],
				entities,
			);
		}
	}
};
