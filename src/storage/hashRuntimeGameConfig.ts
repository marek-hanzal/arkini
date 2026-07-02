import type { GameConfig } from "~/config/GameConfigTypes";
import { sha256 } from "~/hash/logic/sha256";

const normalizeRuntimeGameConfig = (config: GameConfig) =>
	JSON.stringify(config, (_key, value: unknown) => {
		if (typeof value === "string" && value.startsWith("blob:")) return "[blob-url]";
		return value;
	});

export const hashRuntimeGameConfig = (config: GameConfig) =>
	sha256(normalizeRuntimeGameConfig(config));
