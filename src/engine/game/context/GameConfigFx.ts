import { Context } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/**
 * Provides the loaded canonical game configuration to gameplay effects.
 */
export class GameConfigFx extends Context.Tag("GameConfigFx")<
	GameConfigFx,
	GameConfigSchema.Type
>() {
	//
}
