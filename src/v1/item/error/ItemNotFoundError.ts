import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/**
 * No canonical item with the requested ID exists in the loaded game.
 */
export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
	itemId: IdSchema.Type;
}> {}
