import { Effect } from "effect";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import { readOutputMaximumReplaceFx } from "../fx/readOutputMaximumReplaceFx";

export namespace validateCompletionLifecycleFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects output placement that contradicts an item's authored completion lifecycle. */
export const validateCompletionLifecycleFx = Effect.fn("validateCompletionLifecycleFx")(function* ({
	config,
	provenance,
}: validateCompletionLifecycleFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemId, item] of Object.entries(config.items)) {
		if (!("afterCompletion" in item) || item.afterCompletion !== "keep") {
			continue;
		}
		const lines = yield* readItemLineEntriesFx({
			itemId,
			item,
		});
		for (const { line, path } of lines) {
			if (line.output === undefined) {
				continue;
			}
			const maximum = yield* readOutputMaximumReplaceFx({
				output: line.output,
			});
			if (maximum === 0) {
				continue;
			}
			diagnostics.push({
				code: "completion:keep-replace",
				severity: "error",
				path: [
					...path,
					"output",
				],
				source: provenance.items[itemId],
				message: `Line ${line.id} owned by ${itemId} may replace an owner configured to remain after completion.`,
				ownerItemId: itemId,
				lineId: line.id,
				maximum,
			});
		}
	}

	return diagnostics;
});
