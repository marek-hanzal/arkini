import type { Effect } from "effect";

import type { CriticalGameLifecycleOperation } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameSessionServices } from "~/bridge/game/GameSession";

/** Route-facing Game facade whose live reads preserve the resource fail-stop boundary. */
export interface GameEngine extends Game {
	/** Publishes a renderer-side critical failure into this exact resource. */
	readonly reportCriticalFailure: (
		operation: Extract<CriticalGameLifecycleOperation, "game-presentation" | "game-runtime">,
		cause: unknown,
	) => void;
	readonly readOrThrow: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Result;
}
