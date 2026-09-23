import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Creates one empty runtime rooted in the configured explicit start space. */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	const config = yield* GameConfigFx;

	const runtime: RuntimeSchema.Type = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: config.start.currentSpace,
		templateUidBySpace: {},
		items: [],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	};
	return runtime;
});
