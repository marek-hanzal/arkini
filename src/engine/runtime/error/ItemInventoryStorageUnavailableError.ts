import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** One canonical item cannot own a passive Inventory location. */
export class ItemInventoryStorageUnavailableError extends Data.TaggedError(
	"ItemInventoryStorageUnavailableError",
)<{
	readonly itemId: IdSchema.Type;
}> {}
