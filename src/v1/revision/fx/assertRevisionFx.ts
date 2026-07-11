import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { RevisionConflictError } from "~/v1/revision/error/RevisionConflictError";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";

export namespace assertRevisionFx {
	export interface Props {
		actualRevision: RevisionSchema.Type;
		entityId: IdSchema.Type;
		expectedRevision: RevisionSchema.Type;
	}
}

/**
 * Rejects one stale optimistic-concurrency token.
 */
export const assertRevisionFx = Effect.fn("assertRevisionFx")(function* ({
	actualRevision,
	entityId,
	expectedRevision,
}: assertRevisionFx.Props) {
	if (actualRevision !== expectedRevision) {
		return yield* Effect.fail(
			new RevisionConflictError({
				actualRevision,
				entityId,
				expectedRevision,
			}),
		);
	}
});
