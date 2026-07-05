import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readItemInstanceDefinition } from "~/engine/model/GameSaveValidationReaders";

export const validateSaveItemCapacities = ({ config, ctx, save }: GameSaveValidationContext) => {
	for (const [itemInstanceId, state] of Object.entries(save.itemCapacities)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId,
		});
		if (!target) {
			addSaveIssue(
				ctx,
				[
					"itemCapacities",
					itemInstanceId,
				],
				`Item capacity state target "${itemInstanceId}" must reference a save item instance.`,
			);
			continue;
		}

		const capacity = target.item.capacity;
		if (!capacity) {
			addSaveIssue(
				ctx,
				[
					"itemCapacities",
					itemInstanceId,
				],
				`Item capacity state target "${itemInstanceId}" references item "${target.itemId}" without capacity.`,
			);
			continue;
		}

		if (state.remaining > capacity.max) {
			addSaveIssue(
				ctx,
				[
					"itemCapacities",
					itemInstanceId,
					"remaining",
				],
				`remaining must be <= item capacity max (${capacity.max}).`,
			);
		}
	}
};
