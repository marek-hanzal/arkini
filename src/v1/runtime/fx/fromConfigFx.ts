import { Effect } from "effect";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	return {
		items: [],
		jobs: [],
		jobQueue: [],
	} as RuntimeSchema.Type;
});
