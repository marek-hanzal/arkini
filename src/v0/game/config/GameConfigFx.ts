import { Context } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameConfigLayer } from "~/v0/game/config/GameConfigLayerSchema";

export interface GameConfigFxService {
	baseConfig: GameConfig;
	config: GameConfig;
	layer: GameConfigLayer;
}

export class GameConfigFx extends Context.Tag("GameConfigFx")<GameConfigFx, GameConfigFxService>() {
	//
}
