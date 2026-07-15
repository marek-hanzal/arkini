import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/** Creates one empty runtime rooted in the configured explicit start space. */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	const config = yield* GameConfigFx;

	return {
		currentSpace: config.start.currentSpace,
		session: {
			speedMode: "normal" as const,
		},
		items: [],
		jobs: [],
		jobQueue: [],
	} satisfies RuntimeSchema.Type;
});
