import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * One initial inventory quantity cannot fit completely into the configured inventory.
 */
export class StartInventoryUnavailableError extends Data.TaggedError(
	"StartInventoryUnavailableError",
)<{
	itemId: IdSchema.Type;
	quantity: PositiveIntegerSchema.Type;
	remainingQuantity: PositiveIntegerSchema.Type;
}> {}
