import { Cause, Effect, Exit, Option } from "effect";

import { toCriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

/** Wraps one concrete Game in the private lock and fail-stop guard shared by route actions. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")((game: Game) =>
	Effect.makeSemaphore(1).pipe(
		Effect.map((lifecycleLock) => {
			let criticalFailure: ReturnType<typeof toCriticalGameLifecycleError> | null = null;
			const assertUsable = () => {
				if (criticalFailure !== null) throw criticalFailure;
			};
			const markCriticalFailure: GameEngineResource["markCriticalFailure"] = (
				operation,
				cause,
			) => {
				criticalFailure ??= toCriticalGameLifecycleError({
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
						const failure = Cause.failureOption(exit.cause);
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
				withLifecycleLockFx: (effect) => lifecycleLock.withPermits(1)(effect),
			} satisfies GameEngineResource;
		}),
	),
);
