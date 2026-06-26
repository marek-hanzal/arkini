import { readProductOutput } from "~/v0/game/config/readProductOutput";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const readProductOutputItemIds = ({
	config,
	productId,
}: {
	config: GameConfig;
	productId: string;
}): string[] => {
	const itemIds: string[] = [];

	for (const output of readProductOutput({
		config,
		productId,
	})) {
		if (output.type === "weighted") {
			for (const entry of output.entries) itemIds.push(entry.itemId);
			continue;
		}

		itemIds.push(output.itemId);
	}

	return itemIds;
};
