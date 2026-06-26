import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const readProductInputs = ({
	config,
	productId,
}: {
	config: GameConfig;
	productId: string;
}) => {
	const product = config.products[productId];
	if (!product) return [];
	if (product.inputs) return product.inputs;

	const inputRefId = product.inputRefId;
	if (!inputRefId) return [];

	return config.inputs[inputRefId]?.inputs ?? [];
};
