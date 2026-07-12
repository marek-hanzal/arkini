import { Context, type Effect } from "effect";

export interface GameLoopFxService {
	/** Stops the production Tick loop and waits until its current iteration exits. */
	readonly stop: Effect.Effect<void>;
}

/** Lifecycle control for the one production Tick loop owned by a game session. */
export class GameLoopFx extends Context.Tag("GameLoopFx")<GameLoopFx, GameLoopFxService>() {
	//
}
