import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/** A snapshot-derived input run plan no longer matches its immutable draft. */
export class InputRunPlanInvalidError extends Data.TaggedError("InputRunPlanInvalidError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: number;
	itemId: IdSchema.Type;
}> {}
