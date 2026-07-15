import { Effect } from "effect";

import { isItemMaterialInputEligible } from "~/v1/input/read/isItemMaterialInputEligible";
import { matchesSelector } from "~/v1/selector/read/matchesSelector";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import type { GameDiagnosticsSchema } from "../schema/GameDiagnosticsSchema";

export namespace validateMaterialInputEligibilityFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects material selectors whose accepted candidate set contains an ineligible item. */
export const validateMaterialInputEligibilityFx = Effect.fn("validateMaterialInputEligibilityFx")(
	function* ({ config, provenance }: validateMaterialInputEligibilityFx.Props) {
		const diagnostics: GameDiagnosticsSchema.Type = [];

		for (const [ownerItemId, owner] of Object.entries(config.items)) {
			const entries = yield* readItemLineEntriesFx({
				itemId: ownerItemId,
				item: owner,
			});
			for (const { line, path } of entries) {
				for (const [inputIndex, input] of line.input.entries()) {
					if (input.type !== "materials") continue;

					for (const candidate of Object.values(config.items)) {
						const matches = matchesSelector({
							item: candidate,
							selector: input.selector,
						});
						if (!matches || isItemMaterialInputEligible(candidate)) continue;

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
