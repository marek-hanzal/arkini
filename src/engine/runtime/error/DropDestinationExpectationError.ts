import { Data } from "effect";

import type { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";

/** A serialized drop commit no longer owns the exact previewed destination claims. */
export class DropDestinationExpectationError extends Data.TaggedError(
	"DropDestinationExpectationError",
)<{
	readonly reason: DropItemRejectedReasonEnumSchema.Type;
}> {}
