import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A cheat-inventory consume command targeted the wrong runtime identity. */
export class CheatInventoryTargetInvalidError extends Data.TaggedError(
	"CheatInventoryTargetInvalidError",
)<{
	targetItemId: IdSchema.Type;
	targetCanonicalItemId: IdSchema.Type;
}> {}
