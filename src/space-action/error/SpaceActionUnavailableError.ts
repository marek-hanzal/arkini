import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";

/** A Space item cannot currently satisfy its authored immediate action. */
export class SpaceActionUnavailableError extends Data.TaggedError("SpaceActionUnavailableError")<{
	readonly itemId: IdSchema.Type;
}> {}
