import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { match } from "ts-pattern";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { RollTypeSchema } from "~/outcome/schema/RollTypeSchema";

import { readItemOutcomeEntriesFn } from "./readItemOutcomeEntriesFn";

type OutcomeRecreationCertainty = "guaranteed" | "stochastic" | "none";

export namespace validateUnitRenewalFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

const readItemOutcomeCertaintyFn = (
	drops: ReadonlyArray<OutcomeSchema.Type>,
	itemId: IdSchema.Type,
): OutcomeRecreationCertainty => {
	const matching = drops.filter((drop) => drop.type === "item" && drop.itemId === itemId);
	if (matching.length === 0) return "none";
	return matching.some((drop) => drop.rules.length === 0) ? "guaranteed" : "stochastic";
};

const readOutcomeRecreationCertaintyFn = (
	outcome: OutcomeTableSchema.Type,
	itemId: IdSchema.Type,
) => {
	const sets = outcome.set.map((set) => {
		const rolls = set.roll.map(
			(roll): OutcomeRecreationCertainty =>
				match(roll)
					.with(
						{
							type: RollTypeSchema.enum.Guaranteed,
						},
						(guaranteed) => readItemOutcomeCertaintyFn(guaranteed.outcome, itemId),
					)
					.with(
						{
							type: RollTypeSchema.enum.Chance,
						},
						(chance) => {
							if (chance.chance === 0) return "none";
							const drop = readItemOutcomeCertaintyFn(chance.outcome, itemId);
							if (drop === "none") return "none";
							return chance.chance === 1 && drop === "guaranteed"
								? "guaranteed"
								: "stochastic";
						},
					)
					.exhaustive(),
		);

		if (rolls.some((roll) => roll === "guaranteed")) return "guaranteed" as const;
		if (rolls.some((roll) => roll === "stochastic")) return "stochastic" as const;
		return "none" as const;
	});

	if (
		sets.every((set) => set === "guaranteed") &&
		outcome.set.some((set) => set.rules.length === 0)
	)
		return "guaranteed";
	if (sets.some((set) => set !== "none")) return "stochastic";
	return "none";
};

const strongerCertaintyFn = (
	current: OutcomeRecreationCertainty,
	candidate: OutcomeRecreationCertainty,
): OutcomeRecreationCertainty => {
	if (current === "guaranteed" || candidate === "guaranteed") return "guaranteed";
	if (current === "stochastic" || candidate === "stochastic") return "stochastic";
	return "none";
};

/** Warns when a item with units lacks a deterministic configured recreation path. */
export const validateUnitRenewalFn = ({ config, provenance }: validateUnitRenewalFn.Props) => {
	const certainty = new Map<IdSchema.Type, OutcomeRecreationCertainty>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const merge of item.merge ?? []) {
			if (merge.effect === TargetEffectSchema.enum.Replace) {
				certainty.set(merge.result, "guaranteed");
			}
		}
		const outputs = readItemOutcomeEntriesFn({
			itemId,
			item,
		});
		for (const { outcome } of outputs) {
			for (const unitOwnerItemId of Object.keys(config.items)) {
				if (config.items[unitOwnerItemId]?.units === undefined) continue;
				const outcomeCertainty = readOutcomeRecreationCertaintyFn(outcome, unitOwnerItemId);
				certainty.set(
					unitOwnerItemId,
					strongerCertaintyFn(certainty.get(unitOwnerItemId) ?? "none", outcomeCertainty),
				);
			}
		}
	}

	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.units === undefined) continue;
		const itemCertainty = certainty.get(itemId) ?? "none";
		if (itemCertainty === "guaranteed") continue;
		if (itemCertainty === "stochastic") {
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalStochastic,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				path: [
					"items",
					itemId,
				],
				source: provenance.items[itemId],
				message: `Finite item ${itemId} is recreated only through probabilistic, weighted, or conditional outcome paths.`,
				itemId,
			});
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.UnitRenewalMissing,
			severity: DiagnosticSeverityEnumSchema.enum.Warning,
			path: [
				"items",
				itemId,
			],
			source: provenance.items[itemId],
			message: `Finite item ${itemId} has no configured outcome or merge path that recreates it.`,
			itemId,
		});
	}

	return diagnostics;
};
