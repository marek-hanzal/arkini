import { Effect } from "effect";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";
import type { GameSourceProvenanceSchema } from "~/v1/compiler/schema/GameSourceProvenanceSchema";

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
	const diagnostics: GameDiagnosticSchema.Type[] = [];

	for (const [key, category] of Object.entries(config.categories)) {
		if (category.id === key) {
			continue;
		}

		diagnostics.push({
			code: "config:key-id-mismatch",
			severity: "error",
			path: [
				"categories",
				key,
				"id",
			],
			source: provenance.categories[key],
			message: `Category record key ${key} differs from embedded ID ${category.id}.`,
			entity: "category",
			key,
			id: category.id,
		});
	}

	for (const [key, item] of Object.entries(config.items)) {
		if (item.id === key) {
			continue;
		}

		diagnostics.push({
			code: "config:key-id-mismatch",
			severity: "error",
			path: [
				"items",
				key,
				"id",
			],
			source: provenance.items[key],
			message: `Item record key ${key} differs from embedded ID ${item.id}.`,
			entity: "item",
			key,
			id: item.id,
		});
	}

	return diagnostics;
});
