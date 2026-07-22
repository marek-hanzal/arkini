import { Effect } from "effect";

import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputChargesReasonEnumSchema } from "~/engine/validation/schema/InvalidInputChargesReasonEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { SelectorEnumSchema } from "~/engine/selector/schema/SelectorEnumSchema";

import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";

export namespace validateInputChargesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates who may pay each authored line-input charge cost. */
export const validateInputChargesFx = Effect.fn("validateInputChargesFx")(function* ({
	config,
	provenance,
}: validateInputChargesFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemId, item] of Object.entries(config.items)) {
		const lines = yield* readItemLineEntriesFx({
			itemId,
			item,
		});
		for (const { line, path } of lines) {
			let selfCost = 0;
			const exactTargetCosts = new Map<
				string,
				{
					cost: number;
					inputIndex: number;
				}
			>();
			for (const [inputIndex, input] of line.input.entries()) {
				const diagnosticPath = [
					...path,
					"input",
					inputIndex,
					"charges",
				];
				if (input.type === InputEnumSchema.enum.Deposit && input.charges === undefined) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Deposit input ${inputIndex} of line ${line.id} must author a target charge cost.`,
						ownerItemId: itemId,
						lineId: line.id,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum.DepositMissingTargetCost,
					});
					continue;
				}
				if (input.charges === undefined) continue;

				if (input.charges.from === InputChargeFromEnumSchema.enum.Self) {
					if (input.type === InputEnumSchema.enum.Deposit) {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Deposit input ${inputIndex} of line ${line.id} must charge its target, not its owner.`,
							ownerItemId: itemId,
							lineId: line.id,
							inputIndex,
							reason: InvalidInputChargesReasonEnumSchema.enum.DepositMustTarget,
						});
						continue;
					}
					if (item.charges === undefined) {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Line ${line.id} charges owner ${itemId}, but the item has no charges.`,
							ownerItemId: itemId,
							lineId: line.id,
							inputIndex,
							reason: InvalidInputChargesReasonEnumSchema.enum.SelfMissingCharges,
						});
						continue;
					}
					selfCost += input.charges.cost;
					if (selfCost > item.charges.amount) {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Line ${line.id} costs ${selfCost} total self charges, but ${itemId} has only ${item.charges.amount}.`,
							ownerItemId: itemId,
							lineId: line.id,
							inputIndex,
							reason: InvalidInputChargesReasonEnumSchema.enum.SelfInsufficientCharges,
						});
					}
					continue;
				}

				if (input.type !== InputEnumSchema.enum.Deposit) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Only deposit inputs may charge an external target; line ${line.id} input ${inputIndex} is ${input.type}.`,
						ownerItemId: itemId,
						lineId: line.id,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum.TargetRequiresDeposit,
					});
					continue;
				}

				if (input.query.selector.type === SelectorEnumSchema.enum.Item) {
					const payerItemId = input.query.selector.itemId;
					const current = exactTargetCosts.get(payerItemId);
					exactTargetCosts.set(payerItemId, {
						cost: (current?.cost ?? 0) + input.charges.cost,
						inputIndex,
					});
				}

				const targetChargeCost = input.charges.cost;
				const matchedCandidates = yield* selectItemsFx({
					items: Object.values(config.items),
					selector: input.query.selector,
				});
				const available = matchedCandidates.some((candidate) => {
					return (
						(candidate.scope === StorageScopeEnumSchema.enum.Board || candidate.scope === StorageScopeEnumSchema.enum.Any) &&
						candidate.charges !== undefined &&
						candidate.charges.amount >= targetChargeCost
					);
				});
				if (!available) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Deposit input ${inputIndex} of line ${line.id} cannot match any board-capable item with at least ${input.charges.cost} charges.`,
						ownerItemId: itemId,
						lineId: line.id,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum.TargetUnavailable,
					});
				}
			}

			for (const [payerItemId, total] of exactTargetCosts) {
				const payer = config.items[payerItemId];
				if (
					payer === undefined ||
					(payer.scope !== StorageScopeEnumSchema.enum.Board && payer.scope !== StorageScopeEnumSchema.enum.Any) ||
					payer.charges === undefined ||
					payer.maxCount === undefined
				) {
					continue;
				}
				const maximumSupply = payer.charges.amount * payer.maxCount;
				if (total.cost <= maximumSupply) continue;

				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						...path,
						"input",
						total.inputIndex,
						"charges",
					],
					source: provenance.items[itemId],
					message: `Line ${line.id} requires ${total.cost} total charges from exact payer ${payerItemId}, but at most ${maximumSupply} can exist.`,
					ownerItemId: itemId,
					lineId: line.id,
					inputIndex: total.inputIndex,
					reason: InvalidInputChargesReasonEnumSchema.enum.TargetInsufficientTotalCharges,
				});
			}
		}
	}

	return diagnostics;
});
