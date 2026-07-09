import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readItemInstanceDefinition } from "~/engine/model/GameSaveValidationReaders";

export const validateSaveProducerCharges = ({ config, ctx, save }: GameSaveValidationContext) => {
	for (const [itemInstanceId, state] of Object.entries(save.producerCharges)) {
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
					"producerCharges",
					itemInstanceId,
				],
				`Producer charge state target "${itemInstanceId}" must reference a producer-like item.`,
			);
			continue;
		}

		if (producer.charges === undefined) {
			addSaveIssue(
				ctx,
				[
					"producerCharges",
					itemInstanceId,
				],
				`Producer charge state target "${itemInstanceId}" references a producer-like item without finite charges.`,
			);
			continue;
		}

		if (state.remainingCharges > producer.charges) {
			addSaveIssue(
				ctx,
				[
					"producerCharges",
					itemInstanceId,
					"remainingCharges",
				],
				`remainingCharges must be <= producer charges (${producer.charges}).`,
			);
		}
	}
};
