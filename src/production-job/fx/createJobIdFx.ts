import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Creates one fresh stable identity for an active product-line job. */
export const createJobIdFx = Effect.fn("createJobIdFx")(function* () {
	return `job:${createId()}` satisfies IdSchema.Type;
});
