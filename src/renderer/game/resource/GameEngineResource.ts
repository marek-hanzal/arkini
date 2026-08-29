import type {
	CriticalGameLifecycleError,
	CriticalGameLifecycleOperation,
} from "~/renderer/game/resource/CriticalGameLifecycleError";
import type { Game } from "~/renderer/game/Game";
import type { GameEngine } from "~/renderer/game/GameEngine";
import type { PlayableGame } from "~/renderer/game/PlayableGame";

/** One exact Game plus its first-critical-failure guard. Lifecycle locking belongs to its owner. */
export interface GameEngineResource<GameType extends PlayableGame = Game> {
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
