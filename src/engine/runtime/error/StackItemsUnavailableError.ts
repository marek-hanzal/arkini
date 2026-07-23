import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A requested direct stack could not be resolved against the current runtime snapshot. */
export class StackItemsUnavailableError extends Data.TaggedError("StackItemsUnavailableError")<{
	sourceItemId: IdSchema.Type;
	targetItemId: IdSchema.Type;
	reason: StackItemsUnavailableError.Reason;
}> {}

export namespace StackItemsUnavailableError {
	export const Reason = {
		CrossSpace: "cross-space",
		DifferentCanonicalItem: "different-canonical-item",
		SameItem: "same-item",
		SourceNotFound: "source-not-found",
		SourceNotOnGrid: "source-not-on-grid",
		SourceStateful: "source-stateful",
		StaleSourceLocation: "stale-source-location",
		StaleSourceRevision: "stale-source-revision",
		StaleTargetLocation: "stale-target-location",
		StaleTargetRevision: "stale-target-revision",
		TargetFull: "target-full",
		TargetNotFound: "target-not-found",
		TargetNotOnGrid: "target-not-on-grid",
		TargetStateful: "target-stateful",
	} as const;

	export type Reason = (typeof Reason)[keyof typeof Reason];
}
