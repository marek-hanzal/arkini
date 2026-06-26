import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const readProductInputs = ({
	config,
	productId,
}: {
	config: GameConfig;
	productId: string;
}) => config.products[productId]?.inputs ?? [];
