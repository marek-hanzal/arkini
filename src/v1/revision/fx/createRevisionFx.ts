import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";

/**
 * Creates one fresh opaque revision for one live runtime item.
 */
export const createRevisionFx = Effect.fn("createRevisionFx")(function* () {
	return `revision:${createId()}` satisfies RevisionSchema.Type;
});
