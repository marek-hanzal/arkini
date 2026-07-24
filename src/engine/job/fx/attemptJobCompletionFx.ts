import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { completeJobTransitionFx } from "~/engine/job/fx/completeJobTransitionFx";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { isExpectedPlacementDeliveryBlockFx } from "~/engine/placement/read/isExpectedPlacementDeliveryBlockFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace attemptJobCompletionFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				type: "blocked";
				error: PlacementUnavailableError;
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "completed";
				events: readonly GameEventSchema.Type[];
				runtime: RuntimeSchema.Type;
		  };
}

/** Resolves one live ready job and keeps only expected delivery failures local. */
export const attemptJobCompletionFx = Effect.fn("attemptJobCompletionFx")(function* ({
	jobId,
	runtime,
}: attemptJobCompletionFx.Props) {
	return yield* completeJobTransitionFx({
		jobId,
		runtime,
	}).pipe(
		Effect.map(
			(completion) =>
				({
					type: "completed",
					events: completion.events,
					runtime: completion.runtime,
				}) satisfies attemptJobCompletionFx.Result,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			isExpectedPlacementDeliveryBlockFx(error.reason).pipe(
				Effect.flatMap((expected) =>
					expected
						? Effect.succeed({
								type: "blocked",
								error,
								runtime,
							} satisfies attemptJobCompletionFx.Result)
						: Effect.fail(error),
				),
			),
		),
	);
});
