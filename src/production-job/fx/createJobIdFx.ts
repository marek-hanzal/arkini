import { Effect } from "effect";

import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/** Creates one fresh stable identity for an active product-line job. */
export const createJobIdFx = Effect.fn("createJobIdFx")(function* () {
	return `job:${yield* (yield* RuntimeIdentityFx)}` satisfies IdSchema.Type;
});
