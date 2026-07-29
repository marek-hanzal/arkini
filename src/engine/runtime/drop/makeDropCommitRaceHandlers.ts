import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import type { RevisionConflictError } from "~/engine/revision/error/RevisionConflictError";
import type { DropDestinationExpectationError } from "~/engine/runtime/error/DropDestinationExpectationError";
import {
	makeDropRejectedResult,
	makeStaleDropRejectedResult,
} from "~/engine/runtime/drop/makeDropRejectedResult";

/** Normalizes optimistic races shared by all two-actor drop commits. */
export const makeDropCommitRaceHandlers = ({
	sourceItemId,
	targetItemId,
}: {
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
}) => ({
	DropDestinationExpectationError: (error: DropDestinationExpectationError) =>
		Effect.succeed(
			makeDropRejectedResult({
				reason: error.reason,
				sourceItemId,
				targetItemId,
			}),
		),
	ItemNotFoundError: (error: ItemNotFoundError) =>
		Effect.succeed(
			makeStaleDropRejectedResult({
				entityId: error.itemId,
				sourceItemId,
				targetItemId,
			}),
		),
	RevisionConflictError: (error: RevisionConflictError) =>
		Effect.succeed(
			makeStaleDropRejectedResult({
				entityId: error.entityId,
				sourceItemId,
				targetItemId,
			}),
		),
});
