import { Context, type PubSub } from "effect";

import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";

/** Internal transient event bus. Gameplay code publishes only after runtime commit. */
export class GameEventBusFx extends Context.Tag("GameEventBusFx")<
	GameEventBusFx,
	PubSub.PubSub<GameEventBatchSchema.Type>
>() {
	//
}
