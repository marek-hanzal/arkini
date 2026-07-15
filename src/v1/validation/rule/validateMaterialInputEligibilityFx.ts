import { Effect } from "effect";

import { readMaterialInputEligibilityFx } from "~/v1/input/read/readMaterialInputEligibilityFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { selectItemsFx } from "~/v1/selector/fx/selectItemsFx";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import type { GameDiagnosticsSchema } from "../schema/GameDiagnosticsSchema";

export namespace validateMaterialInputEligibilityFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects material selectors whose complete candidate set contains an ineligible item. */
export const validateMaterialInputEligibilityFx = Effect.fn("validateMaterialInputEligibilityFx")(
	function* ({ config, provenance }: validateMaterialInputEligibilityFx.Props) {
		const diagnostics: GameDiagnosticsSchema.Type = [];
		const canonicalItems = Object.values(config.items);

		for (const [ownerItemId, owner] of Object.entries(config.items)) {
			const entries = yield* readItemLineEntriesFx({
				itemId: ownerItemId,
				item: owner,
			});
			for (const { line, path } of entries) {
				for (const [inputIndex, input] of line.input.entries()) {
					if (input.type !== "materials") continue;

					const matchedItems = yield* selectItemsFx({
						items: canonicalItems,
						selector: input.selector,
					});
					const eligibility = yield* readMaterialInputEligibilityFx({
						items: matchedItems,
					});
					for (const candidate of eligibility.ineligibleItems) {
						diagnostics.push({
							code: "input:material-ineligible",
							severity: "error",
							path: [
								...path,
								"input",
								inputIndex,
								"selector",
							],
							source: provenance.items[ownerItemId],
							message: `Material input ${inputIndex} of line ${line.id} accepts item ${candidate.id}, which cannot enter material-input storage.`,
							ownerItemId,
							lineId: line.id,
							inputIndex,
							candidateItemId: candidate.id,
						});
					}
				}
			}
		}

		return diagnostics;
	},
);
