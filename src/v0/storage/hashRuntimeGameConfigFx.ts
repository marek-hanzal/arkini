import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { sha256Fx } from "~/hash/sha256Fx";

const normalizeRuntimeGameConfig = (config: GameConfig) =>
	JSON.stringify(config, (_key, value: unknown) => {
		if (typeof value === "string" && value.startsWith("blob:")) return "[blob-url]";
		return value;
	});

export const hashRuntimeGameConfigFx = Effect.fn("hashRuntimeGameConfigFx")(function* (
	config: GameConfig,
) {
	return yield* sha256Fx(normalizeRuntimeGameConfig(config));
});
