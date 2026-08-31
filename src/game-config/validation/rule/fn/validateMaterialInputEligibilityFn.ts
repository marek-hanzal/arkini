import { readMaterialInputEligibilityFn } from "~/production-input/read/fn/readMaterialInputEligibilityFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

import { readItemLineEntriesFn } from "../../fn/readItemLineEntriesFn";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";

export namespace validateMaterialInputEligibilityFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects material selectors whose complete candidate set contains an ineligible item. */
export const validateMaterialInputEligibilityFn = ({
	config,
	provenance,
}: validateMaterialInputEligibilityFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	const canonicalItems = Object.values(config.items);

	for (const [ownerItemId, owner] of Object.entries(config.items)) {
		const entries = readItemLineEntriesFn({
			itemId: ownerItemId,
			item: owner,
		});
		for (const { line, path } of entries) {
			for (const [inputIndex, input] of line.input.entries()) {
				if (input.type !== TypeSchema.enum.Materials) continue;

				const matchedItems = selectItemsFn({
					items: canonicalItems,
					selector: input.selector,
				});
				const eligibility = readMaterialInputEligibilityFn({
					items: matchedItems,
				});
				for (const candidate of eligibility.ineligibleItems) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputMaterialIneligible,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
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
};
