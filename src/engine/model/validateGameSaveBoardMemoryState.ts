import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readItemInstanceDefinition } from "~/engine/model/GameSaveValidationReaders";

export const validateSaveBoardMemoryLayouts = ({
	config,
	ctx,
	save,
}: GameSaveValidationContext) => {
	for (const [memoryItemInstanceId, layout] of Object.entries(save.boardMemoryLayouts)) {
		const memoryItem = readItemInstanceDefinition({
			config,
			itemInstanceId: memoryItemInstanceId,
			save,
		});
		if (!memoryItem) {
			addSaveIssue(
				ctx,
				[
					"boardMemoryLayouts",
					memoryItemInstanceId,
				],
				`Board memory layout owner "${memoryItemInstanceId}" must exist as a board or inventory instance.`,
			);
		}

		for (const [entryIndex, entry] of layout.items.entries()) {
			if (!config.items[entry.itemId]) {
				addSaveIssue(
					ctx,
					[
						"boardMemoryLayouts",
						memoryItemInstanceId,
						"items",
						entryIndex,
						"itemId",
					],
					`Board memory item "${entry.itemId}" must exist in config.`,
				);
			}

			if (entry.x >= config.game.board.width || entry.y >= config.game.board.height) {
				addSaveIssue(
					ctx,
					[
						"boardMemoryLayouts",
						memoryItemInstanceId,
						"items",
						entryIndex,
					],
					`Board memory cell ${entry.x}:${entry.y} is outside board bounds.`,
				);
			}
		}
	}
};
