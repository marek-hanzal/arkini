import { Effect } from "effect";

import { selectorFx } from "~/v1/selector/fx/selectorFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

export namespace validateMergeViabilityFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects merge rules whose target or replacement can never occupy the board. */
export const validateMergeViabilityFx = Effect.fn("validateMergeViabilityFx")(function* ({
	config,
	provenance,
}: validateMergeViabilityFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [ownerItemId, owner] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (owner.merge ?? []).entries()) {
			const missingExactTarget =
				merge.target.type === "item" && config.items[merge.target.itemId] === undefined;
			if (!missingExactTarget) {
				let targetAvailable = false;
				for (const candidate of Object.values(config.items)) {
					const matches = yield* selectorFx({
						selector: merge.target,
						item: candidate,
					});
					if (matches && (candidate.scope === "board" || candidate.scope === "any")) {
						targetAvailable = true;
						break;
					}
				}
				if (!targetAvailable) {
					diagnostics.push({
						code: "merge:invalid",
						severity: "error",
						path: [
							"items",
							ownerItemId,
							"merge",
							mergeIndex,
							"target",
						],
						source: provenance.items[ownerItemId],
						message: `Merge ${mergeIndex} of item ${ownerItemId} cannot match any board-capable target.`,
						ownerItemId,
						mergeIndex,
						reason: "target-unavailable",
					});
				}
			}

			if (merge.effect !== "replace") continue;
			const result = config.items[merge.result];
			if (result === undefined || result.scope === "board" || result.scope === "any") {
				continue;
			}
			diagnostics.push({
				code: "merge:invalid",
				severity: "error",
				path: [
					"items",
					ownerItemId,
					"merge",
					mergeIndex,
					"result",
				],
				source: provenance.items[ownerItemId],
				message: `Merge ${mergeIndex} of item ${ownerItemId} replaces its board target with inventory-only item ${merge.result}.`,
				ownerItemId,
				mergeIndex,
				reason: "result-unavailable",
			});
		}
	}

	return diagnostics;
});
