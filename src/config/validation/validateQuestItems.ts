import type { GameConfig } from "~/config/GameConfigTypes";
import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import type { z } from "zod";

const questTag = "quest";
const blueprintTag = "blueprint";

const isQuestItem = (item: GameConfig["items"][string]) => item.tags.includes(questTag);

const isBlueprintItemId = (itemId: string) => itemId.startsWith("item:blueprint-");

const isBlueprintItem = (config: GameConfig, itemId: string) =>
	isBlueprintItemId(itemId) || config.items[itemId]?.tags.includes(blueprintTag) === true;

export const validateQuestItems = (ctx: z.RefinementCtx, config: GameConfig) => {
	for (const [itemId, item] of Object.entries(config.items)) {
		if (!isQuestItem(item)) continue;

		if (item.storage !== "both") {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"storage",
				],
				`Quest "${itemId}" must use storage "both" so it can occupy board space but still be stored in inventory.`,
			);
		}

		if (item.maxStackSize !== 1) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"maxStackSize",
				],
				`Quest "${itemId}" must use maxStackSize 1 so multiple quests cannot hide inside one board tile.`,
			);
		}

		if (!item.craft) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"craft",
				],
				`Quest "${itemId}" must define a craft recipe because quests are fulfilled through craft inputs.`,
			);
			continue;
		}

		if (isBlueprintItem(config, item.craft.resultItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"craft",
					"resultItemId",
				],
				`Quest "${itemId}" must not reward blueprint "${item.craft.resultItemId}".`,
			);
		}

		for (const [inputIndex, input] of item.craft.inputs.entries()) {
			if (input.itemId !== item.craft.resultItemId) continue;

			addIssue(
				ctx,
				[
					"items",
					itemId,
					"craft",
					"inputs",
					inputIndex,
					"itemId",
				],
				`Quest "${itemId}" must not take the same item "${input.itemId}" that it rewards.`,
			);
		}
	}
};
