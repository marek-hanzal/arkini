import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A requested inventory-storage target is not the live Inventory opener. */
export class ItemInventoryTargetInvalidError extends Data.TaggedError(
	"ItemInventoryTargetInvalidError",
)<{
	readonly itemId: IdSchema.Type;
}> {}
