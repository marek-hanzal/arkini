import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";

/**
 * Creates one fresh opaque revision for a versioned live runtime entity.
 */
export const createRevisionFx = Effect.fn("createRevisionFx")(function* () {
	return `revision:${createId()}` satisfies RevisionSchema.Type;
});
