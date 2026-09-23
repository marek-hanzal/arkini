import { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import { UnitSourceSchema } from "~/production-input/schema/UnitSourceSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputUnitsReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidInputUnitsReasonEnumSchema";
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

/** Validates who may pay each authored line or immediate action unit cost. */
export const validateInputUnitsFn = ({ config, provenance }: validateInputUnitsFn.Props) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemUid, item] of Object.entries(config.items)) {
		const lines = readItemLineEntriesFn({
			itemUid,
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

		for (const { id: actionId, input: inputs, path } of actions) {
			let selfCost = 0;
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
						source: provenance.items[itemUid],
						message: `Units input ${inputIndex} of action ${actionId} must author a target unit cost.`,
						ownerItemUid: itemUid,
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
							source: provenance.items[itemUid],
							message: `Action ${actionId} units owner ${itemUid}, but the item has no units.`,
							ownerItemUid: itemUid,
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
							source: provenance.items[itemUid],
							message: `Action ${actionId} costs ${selfCost} total self units, but ${itemUid} has only ${item.units.amount}.`,
							ownerItemUid: itemUid,
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
						source: provenance.items[itemUid],
						message: `Only units inputs may unit an external target; action ${actionId} input ${inputIndex} is ${input.type}.`,
						ownerItemUid: itemUid,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputUnitsReasonEnumSchema.enum.TargetRequiresUnits,
					});
					continue;
				}

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
						candidate.units !== undefined && candidate.units.amount >= targetUnitCost
					);
				});
				if (!available) {
					diagnostics.push({
						code: DiagnosticCodeEnumSchema.enum.InputUnitsInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: diagnosticPath,
						source: provenance.items[itemUid],
						message: `Units input ${inputIndex} of action ${actionId} cannot match any item with at least ${input.units.cost} units.`,
						ownerItemUid: itemUid,
						lineId: actionId,
						inputIndex,
						reason: InvalidInputUnitsReasonEnumSchema.enum.TargetUnavailable,
					});
				}
			}
		}
	}

	return diagnostics;
};
