import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** One product line cannot currently start from the locked runtime snapshot. */
export class LineRunUnavailableError extends Data.TaggedError("LineRunUnavailableError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
}> {}
