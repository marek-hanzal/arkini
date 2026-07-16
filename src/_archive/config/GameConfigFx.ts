import { Context } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";

export interface GameConfigFxService {
	config: GameConfig;
}

export class GameConfigFx extends Context.Tag("GameConfigFx")<GameConfigFx, GameConfigFxService>() {
	//
}
