import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

/**
 * One delivered runtime item cannot be accepted by a material input slot.
 */
export class InputMaterialUnavailableError extends Data.TaggedError(
	"InputMaterialUnavailableError",
)<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
	sourceItemId: IdSchema.Type;
}> {}
