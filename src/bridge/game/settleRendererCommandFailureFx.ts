import { Cause, Effect, Option } from "effect";

import type { Game } from "~/bridge/game/Game";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";

/** Projects one renderer command failure while preserving interruption and fail-stop semantics. */
export const settleRendererCommandFailureFx = Effect.fn("settleRendererCommandFailureFx")(
	function* <FailureError, FailureRequirements, FatalError, FatalRequirements>({
		cause,
		game,
		onFailure,
		setFatalCause,
	}: {
		readonly cause: Cause.Cause<unknown>;
		readonly game: Game;
		readonly onFailure: (
			failure: unknown,
		) => Effect.Effect<void, FailureError, FailureRequirements>;
		readonly setFatalCause: (
			cause: Cause.Cause<unknown>,
		) => Effect.Effect<void, FatalError, FatalRequirements>;
	}) {
		if (Cause.hasInterruptsOnly(cause)) {
			return yield* Effect.failCause(cause);
		}
		const failure = readExactCauseFailure(cause);
		if (Option.isSome(failure)) {
			return yield* onFailure(failure.value);
		}
		game.failStop("ui", cause);
		yield* setFatalCause(cause);
		return yield* Effect.failCause(cause);
	},
);
