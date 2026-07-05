import { readLineIds, readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import {
	readEffectiveLineInputSlots,
	readItemInstanceDefinition,
} from "~/engine/model/GameSaveValidationReaders";

export const validateSaveProducerInputs = ({ config, ctx, save }: GameSaveValidationContext) => {
	for (const [itemInstanceId, state] of Object.entries(save.producerInputs)) {
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
					"producerInputs",
					itemInstanceId,
				],
				`Producer input state target "${itemInstanceId}" must reference a producer-like item.`,
			);
			continue;
		}

		for (const [lineId, lineInputState] of Object.entries(state.lineInputs)) {
			if (
				!readLineIds({
					producerDefinition: producer,
				}).includes(lineId)
			) {
				addSaveIssue(
					ctx,
					[
						"producerInputs",
						itemInstanceId,
						"lineInputs",
						lineId,
					],
					`Line "${lineId}" does not belong to producer "${producerId}".`,
				);
				continue;
			}

			const inputSlots = readEffectiveLineInputSlots({
				producer,
				lineId,
			});

			for (const [itemId, quantity] of Object.entries(lineInputState.items)) {
				const inputSlot = inputSlots.find((input) => input.itemId === itemId);
				if (!inputSlot) {
					addSaveIssue(
						ctx,
						[
							"producerInputs",
							itemInstanceId,
							"lineInputs",
							lineId,
							"items",
							itemId,
						],
						`Line "${lineId}" has no input "${itemId}".`,
					);
					continue;
				}

				if (quantity > inputSlot.capacity) {
					addSaveIssue(
						ctx,
						[
							"producerInputs",
							itemInstanceId,
							"lineInputs",
							lineId,
							"items",
							itemId,
						],
						`Stored input quantity must be <= capacity (${inputSlot.capacity}).`,
					);
				}
			}
		}
	}
};
