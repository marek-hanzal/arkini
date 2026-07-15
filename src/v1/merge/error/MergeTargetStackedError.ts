import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** A replacement merge cannot transform one quantity inside a larger target stack. */
export class MergeTargetStackedError extends Data.TaggedError("MergeTargetStackedError")<{
	targetItemId: IdSchema.Type;
	quantity: PositiveIntegerSchema.Type;
}> {}
