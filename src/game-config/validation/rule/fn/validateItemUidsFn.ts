import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";

export namespace validateItemUidsFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects canonical items that share one immutable low-level identity. */
export const validateItemUidsFn = ({ config, provenance }: validateItemUidsFn.Props) => {
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
};
