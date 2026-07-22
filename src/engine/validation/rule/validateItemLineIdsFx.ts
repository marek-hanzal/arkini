import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import type { GameDiagnosticsSchema } from "../schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace validateItemLineIdsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Enforces owner-local line identity without requiring global line-ID uniqueness. */
export const validateItemLineIdsFx = Effect.fn("validateItemLineIdsFx")(function* ({
	config,
	provenance,
}: validateItemLineIdsFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [ownerItemId, item] of Object.entries(config.items)) {
		const firstById = new Map<IdSchema.Type, DiagnosticPathSchema.Type>();
		const entries = yield* readItemLineEntriesFx({
			itemId: ownerItemId,
			item,
		});
		for (const entry of entries) {
			const lineIdPath = [
				...entry.path,
				"id",
			] satisfies DiagnosticPathSchema.Type;
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
});
