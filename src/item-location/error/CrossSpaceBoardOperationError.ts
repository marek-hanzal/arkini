import { Data } from "effect";

import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";

/** A command attempted one direct board operation across isolated spaces. */
export class CrossSpaceBoardOperationError extends Data.TaggedError(
	"CrossSpaceBoardOperationError",
)<{
	fromSpace: NonNegativeIntegerSchema.Type;
	toSpace: NonNegativeIntegerSchema.Type;
}> {}
