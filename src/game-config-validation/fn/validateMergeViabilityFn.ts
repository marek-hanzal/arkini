import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidMergeReasonEnumSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";

export namespace validateMergeViabilityFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects merge rules that spend units from an item without units. */
export const validateMergeViabilityFn = ({
	config,
	provenance,
}: validateMergeViabilityFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [ownerItemId, owner] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (owner.merge ?? []).entries()) {
			if (merge.action === SourceActionSchema.enum.Spend && owner.units === undefined) {
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.MergeInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						"items",
						ownerItemId,
						"merge",
						mergeIndex,
						"action",
					],
					source: provenance.items[ownerItemId],
					message: `Merge ${mergeIndex} of item ${ownerItemId} spends a source unit, but the item has no units.`,
					ownerItemId,
					mergeIndex,
					reason: InvalidMergeReasonEnumSchema.enum.SourceUnitsDisabled,
				});
			}
			const targetId = merge.action === "space" ? ownerItemId : merge.target.itemId;
			const exactTarget = config.items[targetId];
			if (
				merge.effect === TargetEffectSchema.enum.Spend &&
				exactTarget !== undefined &&
				exactTarget.units === undefined
			) {
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.MergeInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						"items",
						ownerItemId,
						"merge",
						mergeIndex,
						"effect",
					],
					source: provenance.items[ownerItemId],
					message: `Merge ${mergeIndex} of item ${ownerItemId} spends a target unit, but selected target ${targetId} has no units.`,
					ownerItemId,
					mergeIndex,
					reason: InvalidMergeReasonEnumSchema.enum.TargetUnitsDisabled,
				});
			}
		}
	}

	return diagnostics;
};
