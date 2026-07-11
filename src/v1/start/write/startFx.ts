import { Effect, SynchronizedRef } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import { RuntimeNotEmptyError } from "~/v1/runtime/error/RuntimeNotEmptyError";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import { planStartFx } from "~/v1/start/fx/planStartFx";

/**
 * Atomically creates the configured initial runtime from one empty game runtime.
 */
export const startFx = Effect.fn("startFx")(function* () {
	const config = yield* GameConfigFx;
	const store = yield* RuntimeStoreFx;

	return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
		return Effect.gen(function* () {
			if (runtime.items.length > 0) {
				return yield* Effect.fail(
					new RuntimeNotEmptyError({
						itemCount: runtime.items.length,
					}),
				);
			}

			const plan = yield* planStartFx({
				runtime,
				start: config.start,
			});
			const [, nextRuntime] = yield* applyPlacementPlanFx({
				plan,
				runtime,
			});
			yield* assertRuntimeFx({
				runtime: nextRuntime,
			});

			return [
				nextRuntime,
				nextRuntime,
			] as const;
		});
	});
});
