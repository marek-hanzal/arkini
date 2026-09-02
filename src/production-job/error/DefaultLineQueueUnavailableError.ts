import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/** The exact live owner no longer exposes an effective default line for a Board queue action. */
export class DefaultLineQueueUnavailableError extends Data.TaggedError(
	"DefaultLineQueueUnavailableError",
)<{
	ownerItemId: IdSchema.Type;
}> {}
