import type {
	CriticalGameLifecycleError,
	CriticalGameLifecycleOperation,
} from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngine } from "~/bridge/game/GameEngine";

/** One exact Game plus its first-critical-failure guard. Lifecycle locking belongs to its owner. */
export interface GameEngineResource {
	readonly game: GameEngine;
	/** Throws the first critical ownership failure once this resource can no longer publish gameplay. */
	readonly assertUsable: () => void;
	/** Permanently marks this resource unusable and returns the canonical fatal error. */
	readonly markCriticalFailure: (
		operation: CriticalGameLifecycleOperation,
		cause: unknown,
	) => CriticalGameLifecycleError;
}
