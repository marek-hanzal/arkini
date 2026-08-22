import { Cause, Effect, Option } from "effect";

import type { PlayableGame } from "~/bridge/game/PlayableGame";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

/** Projects one renderer command failure while preserving interruption and fail-stop semantics. */
export const settleRendererCommandFailureFx = Effect.fn("settleRendererCommandFailureFx")(
	function* <FailureError, FailureRequirements, FatalError, FatalRequirements>({
		cause,
		game,
		onFailure,
		setFatalCause,
	}: {
		readonly cause: Cause.Cause<unknown>;
		readonly game: PlayableGame;
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
		const failure = yield* readExactCauseFailureFx(cause);
		if (Option.isSome(failure)) {
			return yield* onFailure(failure.value);
		}
		game.failStop("ui", cause);
		yield* setFatalCause(cause);
		return yield* Effect.failCause(cause);
	},
);
