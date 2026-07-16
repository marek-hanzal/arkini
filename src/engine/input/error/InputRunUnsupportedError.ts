import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

/**
 * One configured input kind cannot yet participate in line-run preparation.
 */
export class InputRunUnsupportedError extends Data.TaggedError("InputRunUnsupportedError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
	type: InputEnumSchema.Type;
}> {}
