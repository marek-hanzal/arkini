import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

export namespace validateCanonicalIdsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates immutable canonical record keys against their embedded IDs. */
export const validateCanonicalIdsFx = Effect.fn("validateCanonicalIdsFx")(function* ({
	config,
	provenance,
}: validateCanonicalIdsFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [key, category] of Object.entries(config.categories)) {
		if (category.id === key) {
			continue;
		}

		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigKeyIdMismatch,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"categories",
				key,
				"id",
			],
			source: provenance.categories[key],
			message: `Category record key ${key} differs from embedded ID ${category.id}.`,
			entity: DiagnosticRecordEntityEnumSchema.enum.Category,
			key,
			id: category.id,
		});
	}

	for (const [key, item] of Object.entries(config.items)) {
		if (item.id === key) {
			continue;
		}

		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigKeyIdMismatch,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"items",
				key,
				"id",
			],
			source: provenance.items[key],
			message: `Item record key ${key} differs from embedded ID ${item.id}.`,
			entity: DiagnosticRecordEntityEnumSchema.enum.Item,
			key,
			id: item.id,
		});
	}

	return diagnostics;
});
