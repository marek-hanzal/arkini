import { Effect } from "effect";

import { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

import { readItemOutputEntriesFx } from "../fx/readItemOutputEntriesFx";
import {
	readOutputRecreationCertaintyFx,
	type OutputRecreationCertainty,
} from "../fx/readOutputRecreationCertaintyFx";

export namespace validateLimitedDepositsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

const strongerCertainty = (
	current: OutputRecreationCertainty,
	candidate: OutputRecreationCertainty,
): OutputRecreationCertainty => {
	if (current === "guaranteed" || candidate === "guaranteed") return "guaranteed";
	if (current === "stochastic" || candidate === "stochastic") return "stochastic";
	return "none";
};

/** Warns when a finite deposit lacks a deterministic configured recreation path. */
export const validateLimitedDepositsFx = Effect.fn("validateLimitedDepositsFx")(function* ({
	config,
	provenance,
}: validateLimitedDepositsFx.Props) {
	const certainty = new Map<IdSchema.Type, OutputRecreationCertainty>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const merge of item.merge ?? []) {
			if (merge.effect === EffectEnumSchema.enum.Replace) {
				certainty.set(merge.result, "guaranteed");
			}
		}
		const outputs = yield* readItemOutputEntriesFx({
			itemId,
			item,
		});
		for (const { output } of outputs) {
			for (const depositId of Object.keys(config.items)) {
				if (config.items[depositId]?.type !== ItemEnumSchema.enum.Deposit) continue;
				const outputCertainty = yield* readOutputRecreationCertaintyFx(output, depositId);
				certainty.set(
					depositId,
					strongerCertainty(certainty.get(depositId) ?? "none", outputCertainty),
				);
			}
		}
	}

	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.type !== ItemEnumSchema.enum.Deposit || item.charges === undefined) continue;
		const itemCertainty = certainty.get(itemId) ?? "none";
		if (itemCertainty === "guaranteed") continue;
		if (itemCertainty === "stochastic") {
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.DepositStochasticSoftlock,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				path: [
					"items",
					itemId,
				],
				source: provenance.items[itemId],
				message: `Finite deposit ${itemId} is recreated only through probabilistic, weighted, or conditional output paths.`,
				itemId,
			});
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.DepositUnsustainable,
			severity: DiagnosticSeverityEnumSchema.enum.Warning,
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
