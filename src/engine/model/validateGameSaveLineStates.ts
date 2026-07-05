import {
	readLineDefinition,
	readLineIds,
	readProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import { readLineKind } from "~/producer/readLineKind";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readItemInstanceDefinition } from "~/engine/model/GameSaveValidationReaders";

export const validateSaveLineStates = ({ config, ctx, save }: GameSaveValidationContext) => {
	for (const [itemInstanceId, lineState] of Object.entries(save.lines)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId,
		});
		const producerId = target?.itemId;
		const producer = producerId
			? readProducerCapabilityDefinition({
					config,
					producerId,
				})
			: undefined;
		if (!target || !producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"lines",
					itemInstanceId,
				],
				`Line state target "${itemInstanceId}" must reference a producer-like item.`,
			);
			continue;
		}

		if (
			lineState.defaultLineId !== undefined &&
			!readLineIds({
				producerDefinition: producer,
			}).includes(lineState.defaultLineId)
		) {
			addSaveIssue(
				ctx,
				[
					"lines",
					itemInstanceId,
					"defaultLineId",
				],
				`Default line "${lineState.defaultLineId}" does not belong to producer "${producerId}".`,
			);
		} else if (lineState.defaultLineId !== undefined) {
			const line = readLineDefinition({
				producerDefinition: producer,
				lineId: lineState.defaultLineId,
			});
			if (
				line &&
				readLineKind({
					line,
				}) !== "product"
			) {
				addSaveIssue(
					ctx,
					[
						"lines",
						itemInstanceId,
						"defaultLineId",
					],
					`Default line "${lineState.defaultLineId}" must reference a normal line.`,
				);
			}
		}

		if (
			lineState.defaultEffectLineId !== undefined &&
			!readLineIds({
				producerDefinition: producer,
			}).includes(lineState.defaultEffectLineId)
		) {
			addSaveIssue(
				ctx,
				[
					"lines",
					itemInstanceId,
					"defaultEffectLineId",
				],
				`Default effect line "${lineState.defaultEffectLineId}" does not belong to producer "${producerId}".`,
			);
		} else if (lineState.defaultEffectLineId !== undefined) {
			const effectLine = readLineDefinition({
				producerDefinition: producer,
				lineId: lineState.defaultEffectLineId,
			});
			if (
				effectLine &&
				readLineKind({
					line: effectLine,
				}) !== "effect"
			) {
				addSaveIssue(
					ctx,
					[
						"lines",
						itemInstanceId,
						"defaultEffectLineId",
					],
					`Default effect line "${lineState.defaultEffectLineId}" must reference an effect line.`,
				);
			}
		}
	}
};
