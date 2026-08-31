import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";

/** An exact runtime identity is not a splittable stack. */
export class ItemStackSplitUnavailableError extends Data.TaggedError(
	"ItemStackSplitUnavailableError",
)<{
	itemId: IdSchema.Type;
	quantity: number;
}> {}
