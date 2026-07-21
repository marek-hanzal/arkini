import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Creates one empty runtime rooted in the configured explicit start space. */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	const config = yield* GameConfigFx;

	const runtime: RuntimeSchema.Type = {
		cheats: {
			enabled: false,
			instantGameplay: false,
		},
		currentSpace: config.start.currentSpace,
		items: [],
		jobs: [],
		jobQueue: [],
	};
	return runtime;
});
