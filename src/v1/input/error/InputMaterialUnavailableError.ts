import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

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
