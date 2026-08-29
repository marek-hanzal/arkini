import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { TypeSchema as ItemTypeSchema } from "~/engine/item/schema/TypeSchema";

import { readItemLineEntriesFn } from "../../fn/readItemLineEntriesFn";

export namespace validateLineInputCapacityFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Allows positive material buffering capacity only on producer-owned lines. */
export const validateLineInputCapacityFn = ({
	config,
	provenance,
}: validateLineInputCapacityFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.type === ItemTypeSchema.enum.Producer) {
			continue;
		}
		const lines = readItemLineEntriesFn({
			itemId,
			item,
		});
		for (const { line, path } of lines) {
			for (const [inputIndex, input] of line.input.entries()) {
				if (input.type !== TypeSchema.enum.Materials || input.capacity === 0) {
					continue;
				}
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.InputCapacityUnsupported,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						...path,
						"input",
						inputIndex,
						"capacity",
					],
					source: provenance.items[itemId],
					message: `Line ${line.id} owned by ${itemId} cannot buffer materials because only producers support positive input capacity.`,
					ownerItemId: itemId,
					lineId: line.id,
					inputIndex,
					capacity: input.capacity,
				});
			}
		}
	}

	return diagnostics;
};
