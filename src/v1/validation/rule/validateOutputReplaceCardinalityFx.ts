import { Effect } from "effect";

import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { readItemOutputEntriesFx } from "../fx/readItemOutputEntriesFx";
import { readOutputMaximumReplaceFx } from "../fx/readOutputMaximumReplaceFx";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

export namespace validateOutputReplaceCardinalityFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Enforces one origin transformation per selected output result. */
export const validateOutputReplaceCardinalityFx = Effect.fn("validateOutputReplaceCardinalityFx")(
	function* ({ config, provenance }: validateOutputReplaceCardinalityFx.Props) {
		const diagnostics: GameDiagnosticsSchema.Type = [];

		for (const [itemId, item] of Object.entries(config.items)) {
			const outputs = yield* readItemOutputEntriesFx({
				itemId,
				item,
			});
			for (const output of outputs) {
				const maximum = yield* readOutputMaximumReplaceFx({
					output: output.output,
				});
				if (maximum <= 1) {
					continue;
				}

				diagnostics.push({
					code: "output:multiple-replace",
					severity: "error",
					path: output.path,
					source: provenance.items[itemId],
					message: `Output owned by ${itemId} may replace its origin ${maximum} times in one selected result.`,
					ownerItemId: itemId,
					maximum,
				});
			}
		}

		return diagnostics;
	},
);
