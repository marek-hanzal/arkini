import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

/**
 * An item lookup found no canonical item or no item in one runtime grid cell.
 */
export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
	itemId?: IdSchema.Type;
	scope?: ScopeEnumSchema.Type;
	x?: NonNegativeIntegerSchema.Type;
	y?: NonNegativeIntegerSchema.Type;
}> {}
