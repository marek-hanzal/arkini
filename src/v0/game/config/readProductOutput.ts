import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const readProductOutput = ({
	config,
	productId,
}: {
	config: GameConfig;
	productId: string;
}): GameConfig["lootTables"][string]["output"] => {
	const product = config.products[productId];
	if (!product) return [];
	if (product.output) return product.output;
	if (!product.outputTableId) return [];

	return config.lootTables[product.outputTableId]?.output ?? [];
};
