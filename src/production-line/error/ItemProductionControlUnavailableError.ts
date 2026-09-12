import { Data } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";

/** The authored control policy or exhausted lifetime rejects a player operation on this owner. */
export class ItemProductionControlUnavailableError extends Data.TaggedError(
	"ItemProductionControlUnavailableError",
)<{
	readonly ownerItemId: IdSchema.Type;
	readonly reason: "automatic-only" | "not-scheduled" | "expired";
}> {}
