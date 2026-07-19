import type * as Effect from "effect/Effect";

import type { Game } from "~/bridge/game/Game";

/** One cached Game plus the private lock serializing its route-owned lifecycle actions. */
export interface GameEngineResource {
	readonly game: Game;
	readonly withLifecycleLockFx: <Result, Error, Requirements>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Effect.Effect<Result, Error, Requirements>;
}
