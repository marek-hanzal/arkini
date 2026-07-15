import { Data } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

/** A command attempted one direct board operation across isolated spaces. */
export class CrossSpaceBoardOperationError extends Data.TaggedError(
	"CrossSpaceBoardOperationError",
)<{
	fromSpace: NonNegativeIntegerSchema.Type;
	toSpace: NonNegativeIntegerSchema.Type;
}> {}
