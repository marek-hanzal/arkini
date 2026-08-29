import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/game-config/diagnostic/schema/InvalidMergeReasonEnumSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

export namespace validateMergeViabilityFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects merge rules whose target or replacement can never occupy the board. */
export const validateMergeViabilityFn = ({
	config,
	provenance,
}: validateMergeViabilityFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [ownerItemId, owner] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (owner.merge ?? []).entries()) {
			const missingExactTarget = config.items[merge.target.itemId] === undefined;
			if (!missingExactTarget) {
				const exactSelfTargetUnavailable =
					merge.target.itemId === ownerItemId &&
					owner.maxCount === 1 &&
					(owner.scope === StorageSchema.enum.Board ||
						owner.scope === StorageSchema.enum.Any);
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

				const matchedTargets = selectItemsFn({
					items: Object.values(config.items),
					selector: merge.target,
				});
				const targetAvailable = matchedTargets.some((candidate) => {
					return (
						candidate.scope === StorageSchema.enum.Board ||
						candidate.scope === StorageSchema.enum.Any
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

			if (merge.effect !== TargetEffectSchema.enum.Replace) continue;
			const result = config.items[merge.result];
			if (
				result === undefined ||
				result.scope === StorageSchema.enum.Board ||
				result.scope === StorageSchema.enum.Any
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
};
