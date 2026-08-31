import { Context, type Effect } from "effect";

interface GameLoopFxService {
	/** Stops the production Tick loop and waits until its current iteration exits. */
	readonly stop: Effect.Effect<void, never, never>;
}

/** Lifecycle control for the one production Tick loop owned by a game session. */
export class GameLoopFx extends Context.Service<GameLoopFx, GameLoopFxService>()("GameLoopFx") {
	//
}
