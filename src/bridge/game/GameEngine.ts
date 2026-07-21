import type { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameSessionServices } from "~/bridge/game/GameSession";

/** Route-facing Game facade whose live reads preserve the resource fail-stop boundary. */
export interface GameEngine extends Game {
	readonly readOrThrow: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Result;
}
