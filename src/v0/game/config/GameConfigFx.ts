import { Context } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export interface GameConfigFxService {
	config: GameConfig;
}

export class GameConfigFx extends Context.Tag("GameConfigFx")<GameConfigFx, GameConfigFxService>() {
	//
}
