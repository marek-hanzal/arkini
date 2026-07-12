import { Effect } from "effect";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import type { GameDiagnosticsSchema } from "../schema/GameDiagnosticsSchema";

export namespace validateMaterialTagSelectorsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects material tag selectors that can never accept any completed-config item. */
export const validateMaterialTagSelectorsFx = Effect.fn("validateMaterialTagSelectorsFx")(
	function* ({ config, provenance }: validateMaterialTagSelectorsFx.Props) {
		const diagnostics: GameDiagnosticsSchema.Type = [];
		for (const [ownerItemId, item] of Object.entries(config.items)) {
			const entries = yield* readItemLineEntriesFx({
				itemId: ownerItemId,
				item,
			});
			for (const { line, path } of entries) {
				for (const [inputIndex, input] of line.input.entries()) {
					if (input.type !== "materials" || input.selector.type !== "tag") {
						continue;
					}
					const tag = input.selector.tag;
					const matches = Object.values(config.items).some((candidate) =>
						candidate.tags.includes(tag),
					);
					if (!matches) {
						diagnostics.push({
							code: "input:material-tag-empty",
							severity: "error",
							path: [
								...path,
								"input",
								inputIndex,
								"selector",
								"tag",
							],
							source: provenance.items[ownerItemId],
							message: `Material input tag ${tag} matches no canonical item.`,
							ownerItemId,
							lineId: line.id,
							inputIndex,
							tag,
						});
					}
				}
			}
		}
		return diagnostics;
	},
);
