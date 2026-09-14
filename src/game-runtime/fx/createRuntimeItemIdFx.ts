import { Effect } from "effect";

import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/**
 * Creates one stable identity for a newly spawned runtime item.
 */
export const createRuntimeItemIdFx = Effect.fn("createRuntimeItemIdFx")(function* () {
	return `runtime:item:${yield* (yield* RuntimeIdentityFx)}` satisfies IdSchema.Type;
});
