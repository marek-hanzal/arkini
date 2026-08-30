import { Data } from "effect";

import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";

/** A command was admitted against a Board presentation that is no longer current. */
export class CurrentSpaceConflictError extends Data.TaggedError("CurrentSpaceConflictError")<{
	readonly actualSpace: NonNegativeIntegerSchema.Type;
	readonly expectedSpace: NonNegativeIntegerSchema.Type;
}> {}
