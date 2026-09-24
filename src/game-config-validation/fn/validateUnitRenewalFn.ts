import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { match, P } from "ts-pattern";
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
	itemUid: IdSchema.Type,
): OutcomeRecreationCertainty => {
	const matching = drops.filter((drop) => drop.type === "item" && drop.itemUid === itemUid);
	if (matching.length === 0) return "none";
	return matching.some((drop) => drop.rules.length === 0) ? "guaranteed" : "stochastic";
};

const readOutcomeRecreationCertaintyFn = (
	outcome: OutcomeTableSchema.Type,
	itemUid: IdSchema.Type,
) => {
	const sets = outcome.set.map((set) => {
		const rolls = set.roll.map(
			(roll): OutcomeRecreationCertainty =>
				match(roll)
					.with(
						{
							type: RollTypeSchema.enum.Guaranteed,
						},
						(guaranteed) => readItemOutcomeCertaintyFn(guaranteed.outcome, itemUid),
					)
					.with(
						{
							type: RollTypeSchema.enum.Chance,
						},
						(chance) => {
							if (chance.chance === 0) return "none";
							const drop = readItemOutcomeCertaintyFn(chance.outcome, itemUid);
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
	return match([
		current,
		candidate,
	])
		.returnType<OutcomeRecreationCertainty>()
		.with(
			[
				"guaranteed",
				P._,
			],
			[
				P._,
				"guaranteed",
			],
			() => "guaranteed",
		)
		.with(
			[
				"stochastic",
				P._,
			],
			[
				P._,
				"stochastic",
			],
			() => "stochastic",
		)
		.with(
			[
				"none",
				"none",
			],
			() => "none",
		)
		.exhaustive();
};

/** Warns when a item with units lacks a deterministic configured recreation path. */
export const validateUnitRenewalFn = ({ config, provenance }: validateUnitRenewalFn.Props) => {
	const certainty = new Map<IdSchema.Type, OutcomeRecreationCertainty>();
	for (const [itemUid, item] of Object.entries(config.items)) {
		for (const merge of item.merge ?? []) {
			if (merge.effect === TargetEffectSchema.enum.Replace) {
				certainty.set(merge.result, "guaranteed");
			}
		}
		const outputs = readItemOutcomeEntriesFn({
			itemUid,
			item,
		});
		for (const { outcome } of outputs) {
			for (const unitOwnerItemUid of Object.keys(config.items)) {
				if (config.items[unitOwnerItemUid]?.units === undefined) continue;
				const outcomeCertainty = readOutcomeRecreationCertaintyFn(
					outcome,
					unitOwnerItemUid,
				);
				certainty.set(
					unitOwnerItemUid,
					strongerCertaintyFn(
						certainty.get(unitOwnerItemUid) ?? "none",
						outcomeCertainty,
					),
				);
			}
		}
	}

	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [itemUid, item] of Object.entries(config.items)) {
		if (item.units === undefined) continue;
		const itemCertainty = certainty.get(itemUid) ?? "none";
		if (itemCertainty === "guaranteed") continue;
		if (itemCertainty === "stochastic") {
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalStochastic,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				path: [
					"items",
					itemUid,
				],
				source: provenance.items[itemUid],
				message: `Finite item ${itemUid} is recreated only through probabilistic, weighted, or conditional outcome paths.`,
				itemUid,
			});
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.UnitRenewalMissing,
			severity: DiagnosticSeverityEnumSchema.enum.Warning,
			path: [
				"items",
				itemUid,
			],
			source: provenance.items[itemUid],
			message: `Finite item ${itemUid} has no configured outcome or merge path that recreates it.`,
			itemUid,
		});
	}

	return diagnostics;
};
