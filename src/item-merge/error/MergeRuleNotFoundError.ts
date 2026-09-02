import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/** A source item owns no directional merge rule matching the selected target. */
export class MergeRuleNotFoundError extends Data.TaggedError("MergeRuleNotFoundError")<{
	readonly sourceItemId: IdSchema.Type;
	readonly sourceCanonicalItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
	readonly targetCanonicalItemId: IdSchema.Type;
}> {}
