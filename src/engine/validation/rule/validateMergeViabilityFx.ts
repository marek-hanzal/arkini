import { Effect } from "effect";

import { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/engine/validation/schema/InvalidMergeReasonEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { SelectorEnumSchema } from "~/engine/selector/schema/SelectorEnumSchema";

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
				merge.target.type === SelectorEnumSchema.enum.Item &&
				config.items[merge.target.itemId] === undefined;
			if (!missingExactTarget) {
				const exactSelfTargetUnavailable =
					merge.target.type === SelectorEnumSchema.enum.Item &&
					merge.target.itemId === ownerItemId &&
					owner.maxCount === 1 &&
					(owner.scope === StorageScopeEnumSchema.enum.Board ||
						owner.scope === StorageScopeEnumSchema.enum.Any);
				if (exactSelfTargetUnavailable) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.MergeInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: [
							"items",
							ownerItemId,
							"merge",
							mergeIndex,
							"target",
						],
						source: provenance.items[ownerItemId],
						message: `Merge ${mergeIndex} of item ${ownerItemId} requires a second live identity of itself, but maxCount is 1.`,
						ownerItemId,
						mergeIndex,
						reason: InvalidMergeReasonEnumSchema.enum.SelfTargetUnavailable,
					});
				}

				const matchedTargets = yield* selectItemsFx({
					items: Object.values(config.items),
					selector: merge.target,
				});
				const targetAvailable = matchedTargets.some((candidate) => {
					return (
						candidate.scope === StorageScopeEnumSchema.enum.Board ||
						candidate.scope === StorageScopeEnumSchema.enum.Any
					);
				});
				if (!targetAvailable) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.MergeInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
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
						reason: InvalidMergeReasonEnumSchema.enum.TargetUnavailable,
					});
				}
			}

			if (merge.effect !== EffectEnumSchema.enum.Replace) continue;
			const result = config.items[merge.result];
			if (
				result === undefined ||
				result.scope === StorageScopeEnumSchema.enum.Board ||
				result.scope === StorageScopeEnumSchema.enum.Any
			) {
				continue;
			}
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.MergeInvalid,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
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
				reason: InvalidMergeReasonEnumSchema.enum.ResultUnavailable,
			});
		}
	}

	return diagnostics;
});
