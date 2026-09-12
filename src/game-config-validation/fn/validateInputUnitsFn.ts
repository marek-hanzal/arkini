import { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import { UnitSourceSchema } from "~/production-input/schema/UnitSourceSchema";
import { TypeSchema as ItemTypeSchema } from "~/item-definition/schema/TypeSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputUnitsReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidInputUnitsReasonEnumSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";

import { readItemLineEntriesFn } from "./readItemLineEntriesFn";

export namespace validateInputUnitsFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates who may pay each authored Line or Space action unit cost. */
export const validateInputUnitsFn = ({ config, provenance }: validateInputUnitsFn.Props) => {
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
					"units",
				];
				if (input.type === TypeSchema.enum.Units && input.units === undefined) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Units input ${inputIndex} of action ${actionId} must author a target unit cost.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputUnitsReasonEnumSchema.enum.UnitsMissingTargetCost,
					});
					continue;
				}
				if (input.units === undefined) continue;

				if (input.units.from === UnitSourceSchema.enum.Self) {
					if (item.units === undefined) {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Action ${actionId} units owner ${itemId}, but the item has no units.`,
							ownerItemId: itemId,
							lineId: actionId,
							inputIndex,
							reason: InvalidInputUnitsReasonEnumSchema.enum.SelfMissingUnits,
						});
						continue;
					}
					selfCost += input.units.cost;
					if (selfCost > item.units.amount) {
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Action ${actionId} costs ${selfCost} total self units, but ${itemId} has only ${item.units.amount}.`,
							ownerItemId: itemId,
							lineId: actionId,
							inputIndex,
							reason: InvalidInputUnitsReasonEnumSchema.enum.SelfInsufficientUnits,
						});
					}
					continue;
				}

				if (input.type !== TypeSchema.enum.Units) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Only units inputs may unit an external target; action ${actionId} input ${inputIndex} is ${input.type}.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputUnitsReasonEnumSchema.enum.TargetRequiresUnits,
					});
					continue;
				}

				const payerItemId = input.query.selector.itemId;
				const current = exactTargetCosts.get(payerItemId);
				exactTargetCosts.set(payerItemId, {
					cost: (current?.cost ?? 0) + input.units.cost,
					inputIndex,
				});

				const targetUnitCost = input.units.cost;
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
						candidate.units !== undefined &&
						candidate.units.amount >= targetUnitCost
					);
				});
				if (!available) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Units input ${inputIndex} of action ${actionId} cannot match any board-capable item with at least ${input.units.cost} units.`,
						ownerItemId: itemId,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputUnitsReasonEnumSchema.enum.TargetUnavailable,
					});
				}
			}

			for (const [payerItemId, total] of exactTargetCosts) {
				const payer = config.items[payerItemId];
				if (
					payer === undefined ||
					(payer.scope !== StorageSchema.enum.Board &&
						payer.scope !== StorageSchema.enum.Any) ||
					payer.units === undefined ||
					payer.maxCount === undefined
				) {
					continue;
				}
				const maximumSupply = payer.units.amount * payer.maxCount;
				if (total.cost <= maximumSupply) continue;

				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						...path,
						"input",
						total.inputIndex,
						"units",
					],
					source: provenance.items[itemId],
					message: `Action ${actionId} requires ${total.cost} total units from exact payer ${payerItemId}, but at most ${maximumSupply} can exist.`,
					ownerItemId: itemId,
					lineId: actionId,
					inputIndex: total.inputIndex,
					reason: InvalidInputUnitsReasonEnumSchema.enum.TargetInsufficientTotalUnits,
				});
			}
		}
	}

	return diagnostics;
};
