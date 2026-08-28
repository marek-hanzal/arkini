import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A Space item cannot currently satisfy its authored immediate action. */
export class SpaceActionUnavailableError extends Data.TaggedError("SpaceActionUnavailableError")<{
	itemId: IdSchema.Type;
}> {}
