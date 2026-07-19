import { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

/** Wraps one concrete Game in the private semaphore shared by all route lifecycle actions. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")((game: Game) =>
	Effect.makeSemaphore(1).pipe(
		Effect.map(
			(lifecycleLock) =>
				({
					game,
					withLifecycleLockFx: (effect) => lifecycleLock.withPermits(1)(effect),
				}) satisfies GameEngineResource,
		),
	),
);
