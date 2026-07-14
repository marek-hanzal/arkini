import { Effect } from "effect";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";

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
					code: "input:capacity-unsupported",
					severity: "error",
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
