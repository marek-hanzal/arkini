import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** A source item owns no directional merge rule matching the selected target. */
export class MergeRuleNotFoundError extends Data.TaggedError("MergeRuleNotFoundError")<{
	sourceItemId: IdSchema.Type;
	sourceCanonicalItemId: IdSchema.Type;
	targetItemId: IdSchema.Type;
	targetCanonicalItemId: IdSchema.Type;
}> {}
