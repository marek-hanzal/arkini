import { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import { TypeSchema as ItemTypeSchema } from "~/item-definition/schema/TypeSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputChargesReasonEnumSchema } from "~/game-config/diagnostic/schema/InvalidInputChargesReasonEnumSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { DiagnosticPathSchema } from "~/game-config/diagnostic/schema/DiagnosticPathSchema";

import { readItemLineEntriesFn } from "../../fn/readItemLineEntriesFn";

export namespace validateInputChargesFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates who may pay each authored Line or Space action charge cost. */
export const validateInputChargesFn = ({ config, provenance }: validateInputChargesFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemId, item] of Object.entries(config.items)) {
		const lines = readItemLineEntriesFn({
			itemId,
			item,
		});
		const actions: Array<{
			id: IdSchema.Type;
			input: ReadonlyArray<InputSchema.Type>;
			path: DiagnosticPathSchema.Type;
		}> = lines.map(({ line, path }) => ({
			id: line.id,
			input: line.input,
			path,
		}));
		if (item.type === ItemTypeSchema.enum.Space) {
			actions.push({
				id: item.id,
				input: item.input,
				path: [
					"items",
					itemId,
				],
			});
		}
		for (const { id: actionId, input: inputs, path } of actions) {
			let selfCost = 0;
			const exactTargetCosts = new Map<
				string,
				{
					cost: number;
					inputIndex: number;
				}
			>();
			for (const [inputIndex, input] of inputs.entries()) {
				const diagnosticPath = [
					...path,
					"input",
					inputIndex,
					"charges",
				];
				if (
					input.type === TypeSchema.enum.Deposit &&
					input.query.distance === DistanceSchema.enum.Self &&
					item.type !== ItemTypeSchema.enum.Deposit
				) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: [
							...path,
							"input",
							inputIndex,
							"query",
							"distance",
						],
						source: provenance.items[itemId],
						message: `Deposit input ${inputIndex} of action ${actionId} targets self, but owner ${itemId} is ${item.type}, not a deposit.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum
							.DepositSelfRequiresDepositOwner,
					});
					continue;
				}
				if (input.type === TypeSchema.enum.Deposit && input.charges === undefined) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Deposit input ${inputIndex} of action ${actionId} must author a target charge cost.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum.DepositMissingTargetCost,
					});
					continue;
				}
				if (input.charges === undefined) continue;

				if (input.charges.from === ChargeSourceSchema.enum.Self) {
					if (
						input.type === TypeSchema.enum.Deposit &&
						item.type !== ItemTypeSchema.enum.Space
					) {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Deposit input ${inputIndex} of action ${actionId} must charge its target, not its owner.`,
							ownerItemId: itemId,
							lineId: actionId,
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
							message: `Action ${actionId} charges owner ${itemId}, but the item has no charges.`,
							ownerItemId: itemId,
							lineId: actionId,
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
							message: `Action ${actionId} costs ${selfCost} total self charges, but ${itemId} has only ${item.charges.amount}.`,
							ownerItemId: itemId,
							lineId: actionId,
							inputIndex,
							reason: InvalidInputChargesReasonEnumSchema.enum
								.SelfInsufficientCharges,
						});
					}
					continue;
				}

				if (input.type !== TypeSchema.enum.Deposit) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputChargesInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Only deposit inputs may charge an external target; action ${actionId} input ${inputIndex} is ${input.type}.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum.TargetRequiresDeposit,
					});
					continue;
				}

				const payerItemId = input.query.selector.itemId;
				const current = exactTargetCosts.get(payerItemId);
				exactTargetCosts.set(payerItemId, {
					cost: (current?.cost ?? 0) + input.charges.cost,
					inputIndex,
				});

				const targetChargeCost = input.charges.cost;
				const matchedCandidates = selectItemsFn({
					items:
						input.query.distance === DistanceSchema.enum.Self
							? [
									item,
								]
							: Object.values(config.items),
					selector: input.query.selector,
				});
				const available = matchedCandidates.some((candidate) => {
					return (
						(candidate.scope === StorageSchema.enum.Board ||
							candidate.scope === StorageSchema.enum.Any) &&
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
						message: `Deposit input ${inputIndex} of action ${actionId} cannot match any board-capable item with at least ${input.charges.cost} charges.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputChargesReasonEnumSchema.enum.TargetUnavailable,
					});
				}
			}

			for (const [payerItemId, total] of exactTargetCosts) {
				const payer = config.items[payerItemId];
				if (
					payer === undefined ||
					(payer.scope !== StorageSchema.enum.Board &&
						payer.scope !== StorageSchema.enum.Any) ||
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
					message: `Action ${actionId} requires ${total.cost} total charges from exact payer ${payerItemId}, but at most ${maximumSupply} can exist.`,
					ownerItemId: itemId,
					lineId: actionId,
					inputIndex: total.inputIndex,
					reason: InvalidInputChargesReasonEnumSchema.enum.TargetInsufficientTotalCharges,
				});
			}
		}
	}

	return diagnostics;
};
