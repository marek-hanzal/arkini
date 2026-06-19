import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export const normalizeGameConfig = (config: GameConfig) =>
	JSON.stringify(config, (_key, value: unknown) => {
		if (typeof value === "string" && value.startsWith("blob:")) return "[blob-url]";
		return value;
	});
