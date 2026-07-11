import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { InputEnumSchema } from "~/v1/input/schema/InputEnumSchema";

/**
 * One configured input kind cannot yet participate in line-run preparation.
 */
export class InputRunUnsupportedError extends Data.TaggedError("InputRunUnsupportedError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
	type: InputEnumSchema.Type;
}> {}
