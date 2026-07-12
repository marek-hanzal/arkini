import { Effect } from "effect";

import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { readItemOutputEntriesFx } from "../fx/readItemOutputEntriesFx";
import { readOutputItemIdsFx } from "../fx/readOutputItemIdsFx";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

export namespace validateLimitedDepositsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Warns when a finite deposit has no configured output or merge path that recreates it. */
export const validateLimitedDepositsFx = Effect.fn("validateLimitedDepositsFx")(function* ({
	config,
	provenance,
}: validateLimitedDepositsFx.Props) {
	const produced = new Set<string>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const merge of item.merge ?? []) {
			if (merge.effect === "replace") {
				produced.add(merge.result);
			}
		}
		const outputs = yield* readItemOutputEntriesFx({
			itemId,
			item,
		});
		for (const { output } of outputs) {
			for (const outputItemId of yield* readOutputItemIdsFx(output)) {
				produced.add(outputItemId);
			}
		}
	}

	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.type !== "deposit" || produced.has(itemId)) {
			continue;
		}
		diagnostics.push({
			code: "deposit:unsustainable",
			severity: "warning",
			path: [
				"items",
				itemId,
			],
			source: provenance.items[itemId],
			message: `Finite deposit ${itemId} has no configured output or merge path that recreates it.`,
			itemId,
		});
	}

	return diagnostics;
});
