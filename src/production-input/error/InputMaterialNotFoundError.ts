import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";

/**
 * One product-line input position is missing or is not a material input.
 */
export class InputMaterialNotFoundError extends Data.TaggedError("InputMaterialNotFoundError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
}> {}
