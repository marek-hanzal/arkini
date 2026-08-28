import { Data } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

/** A command was admitted against a Board presentation that is no longer current. */
export class CurrentSpaceConflictError extends Data.TaggedError("CurrentSpaceConflictError")<{
	actualSpace: NonNegativeIntegerSchema.Type;
	expectedSpace: NonNegativeIntegerSchema.Type;
}> {}
