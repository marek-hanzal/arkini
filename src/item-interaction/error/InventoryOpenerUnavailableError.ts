import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";

/** One Inventory item cannot be released without the singleton visible Inventory opener. */
export class InventoryOpenerUnavailableError extends Data.TaggedError(
	"InventoryOpenerUnavailableError",
)<{
	readonly itemId: IdSchema.Type;
}> {}
