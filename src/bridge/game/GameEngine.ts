import type { Effect } from "effect";

import type { CriticalGameLifecycleOperation } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameSessionServices } from "~/bridge/game/GameSession";
import type { PlayableGame } from "~/bridge/game/PlayableGame";

/** Presentation-facing facade whose live reads preserve the exact session fail-stop boundary. */
export type GameEngine<GameType extends PlayableGame = PlayableGame> = GameType & {
	/** Publishes a renderer-side critical failure into this exact resource. */
	readonly reportCriticalFailure: (
		operation: Extract<CriticalGameLifecycleOperation, "game-presentation" | "game-runtime">,
		cause: unknown,
	) => void;
	readonly readOrThrow: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Result;
};

/** Installed-package facade used by package routes and durable lifecycle operations. */
export type PackageGameEngine = GameEngine<Game>;
