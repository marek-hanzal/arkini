import { Data } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";

/** Targeted player autofill only admits an empty material slot. */
export class LineInputNotEmptyError extends Data.TaggedError("LineInputNotEmptyError")<{
	readonly ownerItemId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly inputIndex: number;
}> {}
