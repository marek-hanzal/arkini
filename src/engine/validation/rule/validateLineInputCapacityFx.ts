import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace validateLineInputCapacityFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Allows positive material buffering capacity only on producer-owned lines. */
export const validateLineInputCapacityFx = Effect.fn("validateLineInputCapacityFx")(function* ({
	config,
	provenance,
}: validateLineInputCapacityFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.type === "producer") {
			continue;
		}
		const lines = yield* readItemLineEntriesFx({
			itemId,
			item,
		});
		for (const { line, path } of lines) {
			for (const [inputIndex, input] of line.input.entries()) {
				if (input.type !== "materials" || input.capacity === 0) {
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
});
