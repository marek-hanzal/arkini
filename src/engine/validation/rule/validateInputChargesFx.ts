import { Effect } from "effect";

import { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputChargesReasonEnumSchema } from "~/engine/validation/schema/InvalidInputChargesReasonEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { DiagnosticPathSchema } from "~/engine/validation/schema/DiagnosticPathSchema";

import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";

export namespace validateInputChargesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates who may pay each authored Line or Space action charge cost. */
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
		const actions: Array<{
			id: IdSchema.Type;
			implicitSelfCost: number;
			input: ReadonlyArray<InputSchema.Type>;
			path: DiagnosticPathSchema.Type;
		}> = lines.map(({ line, path }) => ({
			id: line.id,
			implicitSelfCost: 0,
			input: line.input,
			path,
		}));
		if (item.type === ItemEnumSchema.enum.Space) {
			actions.push({
				id: item.id,
				implicitSelfCost: item.charges === undefined ? 0 : 1,
				input: item.input,
				path: [
					"items",
					itemId,
				],
			});
		}
		for (const { id: actionId, implicitSelfCost, input: inputs, path } of actions) {
			let selfCost = implicitSelfCost;
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
					input.type === InputEnumSchema.enum.Deposit &&
					input.query.distance === DistanceEnumSchema.enum.Self &&
					item.type !== ItemEnumSchema.enum.Deposit
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
				if (input.type === InputEnumSchema.enum.Deposit && input.charges === undefined) {
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

				if (input.charges.from === InputChargeFromEnumSchema.enum.Self) {
					if (
						input.type === InputEnumSchema.enum.Deposit &&
						item.type !== ItemEnumSchema.enum.Space
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

				if (input.type !== InputEnumSchema.enum.Deposit) {
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
				const matchedCandidates = yield* selectItemsFx({
					items:
						input.query.distance === DistanceEnumSchema.enum.Self
							? [
									item,
								]
							: Object.values(config.items),
					selector: input.query.selector,
				});
				const available = matchedCandidates.some((candidate) => {
					return (
						(candidate.scope === StorageScopeEnumSchema.enum.Board ||
							candidate.scope === StorageScopeEnumSchema.enum.Any) &&
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
					(payer.scope !== StorageScopeEnumSchema.enum.Board &&
						payer.scope !== StorageScopeEnumSchema.enum.Any) ||
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
});
