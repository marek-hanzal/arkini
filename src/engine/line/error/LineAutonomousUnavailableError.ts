import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** The requested line does not opt into player-controlled autonomous cycles. */
export class LineAutonomousUnavailableError extends Data.TaggedError(
	"LineAutonomousUnavailableError",
)<{
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
}> {}
