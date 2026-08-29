import type { Effect } from "effect";

import type { CriticalGameLifecycleOperation } from "~/renderer/game/resource/CriticalGameLifecycleError";
import type { Game } from "~/renderer/game/Game";
import type { GameSessionServices } from "~/renderer/game/session/GameSession";
import type { PlayableGame } from "~/renderer/game/PlayableGame";

/** Live presentation capability for one loaded game and its exact fail-stop boundary. */
export type GameEngine<GameType extends PlayableGame = PlayableGame> = GameType & {
	/** Publishes a renderer-side critical failure into this exact resource. */
	readonly reportCriticalFailure: (
		operation: Extract<CriticalGameLifecycleOperation, "game-presentation" | "game-runtime">,
		cause: unknown,
	) => void;
	/**
	 * Synchronously runs a query and escalates failure through the resource boundary.
	 * This execution mode is not an authority wall; callers own the query/command choice.
	 */
	readonly readOrThrow: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Result;
};

/** Installed-package capability used by package routes and durable lifecycle operations. */
export type PackageGameEngine = GameEngine<Game>;
