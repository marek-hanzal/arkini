import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const readProductOutput = ({
	config,
	productId,
}: {
	config: GameConfig;
	productId: string;
}) => config.products[productId]?.output ?? [];
