import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** A generic identity-changing operation targeted an item that owns runtime state. */
export class ItemStatefulError extends Data.TaggedError("ItemStatefulError")<{
	itemId: IdSchema.Type;
}> {}
