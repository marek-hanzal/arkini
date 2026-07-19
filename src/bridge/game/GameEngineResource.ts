import type * as Effect from "effect/Effect";

import type {
	CriticalGameLifecycleError,
	CriticalGameLifecycleOperation,
} from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";

/** One cached Game plus the private lock and fail-stop guard for route lifecycle actions. */
export interface GameEngineResource {
	readonly game: Game;
	/** Throws the first critical ownership failure once this resource can no longer publish gameplay. */
	readonly assertUsable: () => void;
	/** Permanently marks this resource unusable and returns the canonical fatal error. */
	readonly markCriticalFailure: (
		operation: CriticalGameLifecycleOperation,
		cause: unknown,
	) => CriticalGameLifecycleError;
	readonly withLifecycleLockFx: <Result, Error, Requirements>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Effect.Effect<Result, Error, Requirements>;
}
