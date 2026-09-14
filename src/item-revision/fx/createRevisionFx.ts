import { Effect } from "effect";

import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";

import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";

/**
 * Creates one fresh opaque revision for one live runtime item.
 */
export const createRevisionFx = Effect.fn("createRevisionFx")(function* () {
	return `revision:${yield* (yield* RuntimeIdentityFx)}` satisfies RevisionSchema.Type;
});
