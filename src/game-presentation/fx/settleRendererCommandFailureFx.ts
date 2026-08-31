import { Cause, Effect, Option } from "effect";

import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";

/** Projects one renderer command failure while preserving interruption and fail-stop semantics. */
export const settleRendererCommandFailureFx = Effect.fn("settleRendererCommandFailureFx")(
	function* <FailureError, FailureRequirements, FatalError, FatalRequirements>({
		cause,
		game,
		onFailureFx,
		setFatalCauseFx,
	}: {
		readonly cause: Cause.Cause<unknown>;
		readonly game: PlayableGame;
		readonly onFailureFx: (
			failure: unknown,
		) => Effect.Effect<void, FailureError, FailureRequirements>;
		readonly setFatalCauseFx: (
			cause: Cause.Cause<unknown>,
		) => Effect.Effect<void, FatalError, FatalRequirements>;
	}) {
		if (Cause.hasInterruptsOnly(cause)) {
			return yield* Effect.failCause(cause);
		}
		const failure = readExactCauseFailureFn(cause);
		if (Option.isSome(failure)) {
			return yield* onFailureFx(failure.value);
		}
		game.failStopFn("ui", cause);
		yield* setFatalCauseFx(cause);
		return yield* Effect.failCause(cause);
	},
);
