import type { Effect } from "effect";

import type { CriticalGameLifecycleOperation } from "~/renderer/game/resource/CriticalGameLifecycleError";
import type { Game } from "~/renderer/game/Game";
import type { GameSessionServices } from "~/renderer/game/session/GameSession";
import type { PlayableGame } from "~/renderer/game/PlayableGame";

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
