import type {
	CriticalGameLifecycleError,
	CriticalGameLifecycleOperation,
} from "~/playable-game/error/CriticalGameLifecycleError";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";

/** One exact Game plus its first-critical-failure guard. Lifecycle locking belongs to its owner. */
export interface GameEngineResource<GameType extends PlayableGame = PlayableGame> {
	readonly game: GameEngine<GameType>;
	/** Returns the exact first critical failure, or null while this resource is usable. */
	readonly getCriticalFailure: () => CriticalGameLifecycleError | null;
	/** Notifies exactly once when this resource first becomes critically unusable. */
	readonly subscribeCriticalFailure: (listener: () => void) => () => void;
	/** Throws the first critical ownership failure once this resource can no longer publish gameplay. */
	readonly assertUsable: () => void;
	/** Permanently marks this resource unusable and returns the canonical fatal error. */
	readonly markCriticalFailure: (
		operation: CriticalGameLifecycleOperation,
		cause: unknown,
	) => CriticalGameLifecycleError;
}
