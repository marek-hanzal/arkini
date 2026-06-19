import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export type GameItemStorageLocation = "board" | "inventory";

export const isItemStorageAllowed = ({
	config,
	itemId,
	location,
}: {
	config: GameConfig;
	itemId: string;
	location: GameItemStorageLocation;
}) => {
	const storage = config.items[itemId]?.storage ?? "both";

	return storage === "both" || storage === location;
};
