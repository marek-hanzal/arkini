import { GameConfigSchema } from "./GameConfigSchema";

export function parseGameConfig(config: parseGameConfig.Input) {
	return GameConfigSchema.parse(config);
}

export namespace parseGameConfig {
	export type Input = unknown;
}
