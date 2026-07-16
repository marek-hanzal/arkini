import { Effect } from "effect";

import type { SpeedModeChangedGameEventSchema } from "~/engine/event/schema/SpeedModeChangedGameEventSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { runTickRuntimeFx } from "~/engine/tick/fx/runTickRuntimeFx";

/**
 * Folds wall time under the current mode, then atomically toggles the runtime session speed.
 */
export const toggleSpeedModeFx = Effect.fn("toggleSpeedModeFx")(function* () {
	yield* runTickRuntimeFx();

	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const speedMode = runtime.session.speedMode === "normal" ? "accelerated" : "normal";
			const event = {
				type: "speed-mode:changed",
				speedMode,
			} satisfies SpeedModeChangedGameEventSchema.Type;
			const nextRuntime = {
				...runtime,
				session: {
					...runtime.session,
					speedMode,
				},
			} satisfies RuntimeSchema.Type;

			return [
				speedMode,
				nextRuntime,
				[
					event,
				],
			] as const;
		}),
	);
});
