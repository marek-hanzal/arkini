import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { RuntimeNotEmptyError } from "~/v1/runtime/error/RuntimeNotEmptyError";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { planStartFx } from "~/v1/start/fx/planStartFx";

/**
 * Atomically creates the configured initial runtime from one empty game runtime.
 */
export const startFx = Effect.fn("startFx")(function* () {
	const config = yield* GameConfigFx;
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			if (runtime.items.length > 0) {
				return yield* Effect.fail(
					new RuntimeNotEmptyError({
						itemCount: runtime.items.length,
					}),
				);
			}

			const nextRuntime = yield* planStartFx({
				runtime,
				start: config.start,
			});

			return [
				nextRuntime,
				nextRuntime,
			] as const;
		});
	});
});
