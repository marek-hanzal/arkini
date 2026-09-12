import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

export namespace validateItemLineIdsFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Enforces owner-local line identity and at most one authored line per selection. */
export const validateItemLineIdsFn = ({ config, provenance }: validateItemLineIdsFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [ownerItemId, item] of Object.entries(config.items)) {
		const firstById = new Map<IdSchema.Type, DiagnosticPathSchema.Type>();
		const firstSelections = new Map<
			"default" | "clock",
			{
				lineId: IdSchema.Type;
				path: DiagnosticPathSchema.Type;
			}
		>();
		const entries = readItemLineEntriesFn({
			itemId: ownerItemId,
			item,
		});
		for (const entry of entries) {
			const lineIdPath = [
				...entry.path,
				"id",
			] satisfies DiagnosticPathSchema.Type;
			for (const selection of [
				"default",
				"clock",
			] as const) {
				if (!entry.line[selection]) continue;
				const path = [
					...entry.path,
					selection,
				];
				const first = firstSelections.get(selection);
				if (first === undefined)
					firstSelections.set(selection, {
						lineId: entry.line.id,
						path,
					});
				else
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.LineMultipleSelections,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path,
						source: provenance.items[ownerItemId],
						selection,
						message: `Item ${ownerItemId} marks both ${first.lineId} and ${entry.line.id} as authored ${selection} lines.`,
						ownerItemId,
						lineIds: [
							first.lineId,
							entry.line.id,
						],
						paths: [
							first.path,
							path,
						],
					});
			}
			const previousPath = firstById.get(entry.line.id);
			if (previousPath !== undefined) {
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.LineDuplicateId,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: lineIdPath,
					source: provenance.items[ownerItemId],
					message: `Item ${ownerItemId} owns more than one line with ID ${entry.line.id}.`,
					ownerItemId,
					lineId: entry.line.id,
					paths: [
						previousPath,
						lineIdPath,
					],
				});
				continue;
			}
			firstById.set(entry.line.id, lineIdPath);
		}
	}
	return diagnostics;
};
