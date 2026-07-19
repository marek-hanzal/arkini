import { Effect } from "effect";

import { toCriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

/** Wraps one concrete Game in the private lock and fail-stop guard shared by route actions. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")((game: Game) =>
	Effect.makeSemaphore(1).pipe(
		Effect.map((lifecycleLock) => {
			let criticalFailure: ReturnType<typeof toCriticalGameLifecycleError> | null = null;
			const assertUsable = () => {
				if (criticalFailure !== null) throw criticalFailure;
			};
			return {
				game,
				assertUsable,
				markCriticalFailure: (operation, cause) => {
					criticalFailure ??= toCriticalGameLifecycleError({
						operation,
						cause,
					});
					return criticalFailure;
				},
				withLifecycleLockFx: (effect) => lifecycleLock.withPermits(1)(effect),
			} satisfies GameEngineResource;
		}),
	),
);
