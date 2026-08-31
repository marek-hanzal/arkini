import { Context } from "effect";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

/**
 * Provides the loaded canonical game configuration to gameplay effects.
 */
export class GameConfigFx extends Context.Service<GameConfigFx, GameConfigSchema.Type>()(
	"GameConfigFx",
) {
	//
}
