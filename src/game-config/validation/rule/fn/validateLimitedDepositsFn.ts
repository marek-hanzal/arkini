import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";
import { match } from "ts-pattern";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { TypeSchema as RollTypeSchema } from "~/engine/roll/schema/TypeSchema";

import { readItemOutputEntriesFn } from "../../fn/readItemOutputEntriesFn";

type OutputRecreationCertainty = "guaranteed" | "stochastic" | "none";

export namespace validateLimitedDepositsFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

const readDropCertaintyFn = (
	drops: ReadonlyArray<DropSchema.Type>,
	itemId: IdSchema.Type,
): OutputRecreationCertainty => {
	const matching = drops.filter((drop) => drop.itemId === itemId);
	if (matching.length === 0) return "none";
	return matching.some((drop) => drop.rules.length === 0) ? "guaranteed" : "stochastic";
};

const readOutputRecreationCertaintyFn = (output: OutputSchema.Type, itemId: IdSchema.Type) => {
	const sets = output.set.map((set) => {
		const rolls = set.roll.map(
			(roll): OutputRecreationCertainty =>
				match(roll)
					.with(
						{
							type: RollTypeSchema.enum.Guaranteed,
						},
						(guaranteed) => readDropCertaintyFn(guaranteed.drop, itemId),
					)
					.with(
						{
							type: RollTypeSchema.enum.Chance,
						},
						(chance) => {
							if (chance.chance === 0) return "none";
							const drop = readDropCertaintyFn(chance.drop, itemId);
							if (drop === "none") return "none";
							return chance.chance === 1 && drop === "guaranteed"
								? "guaranteed"
								: "stochastic";
						},
					)
					.with(
						{
							type: RollTypeSchema.enum.Weight,
						},
						(weight) => {
							const candidates = weight.drop.map((candidate) =>
								readDropCertaintyFn(candidate.drop, itemId),
							);
							if (candidates.every((candidate) => candidate === "guaranteed"))
								return "guaranteed";
							return candidates.some((candidate) => candidate !== "none")
								? "stochastic"
								: "none";
						},
					)
					.exhaustive(),
		);

		if (rolls.some((roll) => roll === "guaranteed")) return "guaranteed" as const;
		if (rolls.some((roll) => roll === "stochastic")) return "stochastic" as const;
		return "none" as const;
	});

	if (sets.every((set) => set === "guaranteed")) return "guaranteed";
	if (sets.some((set) => set !== "none")) return "stochastic";
	return "none";
};

const strongerCertaintyFn = (
	current: OutputRecreationCertainty,
	candidate: OutputRecreationCertainty,
): OutputRecreationCertainty => {
	if (current === "guaranteed" || candidate === "guaranteed") return "guaranteed";
	if (current === "stochastic" || candidate === "stochastic") return "stochastic";
	return "none";
};

/** Warns when a finite deposit lacks a deterministic configured recreation path. */
export const validateLimitedDepositsFn = ({
	config,
	provenance,
}: validateLimitedDepositsFn.Props) => {
	const certainty = new Map<IdSchema.Type, OutputRecreationCertainty>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const merge of item.merge ?? []) {
			if (merge.effect === TargetEffectSchema.enum.Replace) {
				certainty.set(merge.result, "guaranteed");
			}
		}
		const outputs = readItemOutputEntriesFn({
			itemId,
			item,
		});
		for (const { output } of outputs) {
			for (const depositId of Object.keys(config.items)) {
				if (config.items[depositId]?.type !== TypeSchema.enum.Deposit) continue;
				const outputCertainty = readOutputRecreationCertaintyFn(output, depositId);
				certainty.set(
					depositId,
					strongerCertaintyFn(certainty.get(depositId) ?? "none", outputCertainty),
				);
			}
		}
	}

	const diagnostics: GameDiagnosticsSchema.Type = [];
	for (const [itemId, item] of Object.entries(config.items)) {
		if (item.type !== TypeSchema.enum.Deposit || item.charges === undefined) continue;
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
};
