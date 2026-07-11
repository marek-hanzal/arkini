import { Context } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";

/**
 * Provides the loaded canonical game configuration to gameplay effects.
 */
export class GameFx extends Context.Tag("GameFx")<GameFx, GameSchema.Type>() {
	//
}
