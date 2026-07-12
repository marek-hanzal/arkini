import { Context, type Effect, type Queue, type Scope } from "effect";

import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";

export interface GameEventsFxService {
	/** Creates one scoped subscription receiving future committed event batches. */
	readonly subscribe: Effect.Effect<Queue.Dequeue<GameEventBatchSchema.Type>, never, Scope.Scope>;
}

/** Read-only access to transient committed game events. */
export class GameEventsFx extends Context.Tag("GameEventsFx")<GameEventsFx, GameEventsFxService>() {
	//
}
