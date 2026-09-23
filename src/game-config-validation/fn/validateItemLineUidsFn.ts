import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

export namespace validateItemLineUidsFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Line UIDs are project-wide identities; the authored Default remains owner-local. */
export const validateItemLineUidsFn = ({ config, provenance }: validateItemLineUidsFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	const firstByUid = new Map<IdSchema.Type, DiagnosticPathSchema.Type>();
	for (const [ownerItemUid, item] of Object.entries(config.items)) {
		let firstDefault:
			| {
					lineUid: IdSchema.Type;
					path: DiagnosticPathSchema.Type;
			  }
			| undefined;
		const entries = readItemLineEntriesFn({
			itemUid: ownerItemUid,
			item,
		});
		for (const entry of entries) {
			const lineUidPath = [
				...entry.path,
				"uid",
			] satisfies DiagnosticPathSchema.Type;
			if (entry.line.default) {
				const path = [
					...entry.path,
					"default",
				];
				const first = firstDefault;
				if (first === undefined)
					firstDefault = {
						lineUid: entry.line.uid,
						path,
					};
				else
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.LineMultipleSelections,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path,
						source: provenance.items[ownerItemUid],
						selection: "default",
						message: `Item ${ownerItemUid} marks both ${first.lineUid} and ${entry.line.uid} as authored default lines.`,
						ownerItemUid,
						lineUids: [
							first.lineUid,
							entry.line.uid,
						],
						paths: [
							first.path,
							path,
						],
					});
			}
			const previousPath = firstByUid.get(entry.line.uid);
			if (previousPath !== undefined) {
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.LineDuplicateUid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: lineUidPath,
					source: provenance.items[ownerItemUid],
					message: `Line UID ${entry.line.uid} is duplicated at ${JSON.stringify(previousPath)} and ${JSON.stringify(lineUidPath)}. Line UIDs must be unique across the project.`,
					ownerItemUid,
					lineUid: entry.line.uid,
					paths: [
						previousPath,
						lineUidPath,
					],
				});
				continue;
			}
			firstByUid.set(entry.line.uid, lineUidPath);
		}
	}
	return diagnostics;
};
