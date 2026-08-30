import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";

/**
 * A write command targeted an entity revision that is no longer current.
 */
export class RevisionConflictError extends Data.TaggedError("RevisionConflictError")<{
	actualRevision: RevisionSchema.Type;
	entityId: IdSchema.Type;
	expectedRevision: RevisionSchema.Type;
}> {}
