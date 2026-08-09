import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** One exact initial grid slot cannot hold the complete requested stack quantity. */
export class StartSlotUnavailableError extends Data.TaggedError("StartSlotUnavailableError")<{
	itemId: IdSchema.Type;
	quantity: PositiveIntegerSchema.Type;
	remainingQuantity: PositiveIntegerSchema.Type;
	scope:
		| typeof LocationScopeEnumSchema.enum.Board
		| typeof LocationScopeEnumSchema.enum.Inventory
		| typeof LocationScopeEnumSchema.enum.Toolbar;
}> {}
