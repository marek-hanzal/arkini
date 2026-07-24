import { Effect, Exit, Option } from "effect";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";

/** Wraps one concrete Game in the fail-stop guard owned by the renderer lifecycle service. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")((game: Game) =>
	Effect.sync(() => {
		let criticalFailure: CriticalGameLifecycleError | null = null;
		const assertUsable = () => {
			if (criticalFailure !== null) throw criticalFailure;
		};
		const markCriticalFailure: GameEngineResource["markCriticalFailure"] = (
			operation,
			cause,
		) => {
			criticalFailure ??=
				cause instanceof CriticalGameLifecycleError
					? cause
					: new CriticalGameLifecycleError({
							operation,
							cause,
						});
			return criticalFailure;
		};
		const engine = {
			...game,
			readOrThrow: (effect) => {
				assertUsable();
				const exit = game.read(effect);
				if (Exit.isFailure(exit)) {
					const failure = readExactCauseFailure(exit.cause);
					throw markCriticalFailure(
						"game-read",
						Option.isSome(failure) ? failure.value : exit.cause,
					);
				}
				return exit.value;
			},
		} satisfies GameEngine;
		return {
			game: engine,
			assertUsable,
			markCriticalFailure,
		} satisfies GameEngineResource;
	}),
);
