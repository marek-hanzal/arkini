import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace validateItemUidsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects canonical items that share one immutable low-level identity. */
export const validateItemUidsFx = Effect.fn("validateItemUidsFx")(function* ({
	config,
	provenance,
}: validateItemUidsFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	const firstItemByUid = new Map<string, string>();

	for (const [itemId, item] of Object.entries(config.items)) {
		const firstItemId = firstItemByUid.get(item.uid);
		if (firstItemId === undefined) {
			firstItemByUid.set(item.uid, itemId);
			continue;
		}

		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ItemDuplicateUid,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"items",
				itemId,
				"uid",
			],
			source: provenance.items[itemId],
			message: `Items ${firstItemId} and ${itemId} share immutable UID ${item.uid}.`,
			uid: item.uid,
			itemIds: [
				firstItemId,
				itemId,
			],
			paths: [
				[
					"items",
					firstItemId,
					"uid",
				],
				[
					"items",
					itemId,
					"uid",
				],
			],
		});
	}

	return diagnostics;
});
