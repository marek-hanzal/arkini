import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { sha256 } from "~/v0/hash/logic/sha256";

const normalizeRuntimeGameConfig = (config: GameConfig) =>
	JSON.stringify(config, (_key, value: unknown) => {
		if (typeof value === "string" && value.startsWith("blob:")) return "[blob-url]";
		return value;
	});

export const hashRuntimeGameConfig = (config: GameConfig) =>
	sha256(normalizeRuntimeGameConfig(config));
