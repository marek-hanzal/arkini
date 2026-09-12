import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/** An item cannot currently satisfy its authored immediate action. */
export class ItemActionUnavailableError extends Data.TaggedError("ItemActionUnavailableError")<{
	readonly itemId: IdSchema.Type;
}> {}
