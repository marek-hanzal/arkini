import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";

/**
 * Creates one stable identity for a newly spawned runtime item.
 */
export const createRuntimeItemIdFx = Effect.fn("createRuntimeItemIdFx")(function* () {
	return `runtime:item:${createId()}` satisfies IdSchema.Type;
});
