import type {
	CriticalGameLifecycleError,
	CriticalGameLifecycleOperation,
} from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { PlayableGame } from "~/bridge/game/PlayableGame";

/** One exact Game plus its first-critical-failure guard. Lifecycle locking belongs to its owner. */
export interface GameEngineResource<
	SessionType extends PlayableGame = Game,
	Metadata extends GameEngine.Metadata = GameEngine.PackageMetadata,
> {
	/** Broad lifecycle owner retained inside the bridge resource boundary. */
	readonly session: SessionType;
	/** Non-owning presentation facade for React and Pixi. */
	readonly game: GameEngine<Metadata>;
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
