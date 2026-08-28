import { Effect } from "effect";

import type { GameSession } from "~/bridge/game/GameSession";

/** Discards a session plus any resources allocated before a Game could be published. */
export const discardGameBootstrapFx = Effect.fn("discardGameBootstrapFx")(
	(session: GameSession, releaseResourcesFx: Effect.Effect<void, unknown>) =>
		session.disposeWithoutSaveFx.pipe(
			Effect.ignore,
			Effect.andThen(releaseResourcesFx),
			Effect.ignore,
		),
);
