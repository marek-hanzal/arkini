import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { completeJobTransitionFx } from "~/production-job/fx/completeJobTransitionFx";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
				facts: readonly EngineFact[];
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
					facts: completion.facts,
					runtime: completion.runtime,
				}) satisfies attemptJobCompletionFx.Result,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies attemptJobCompletionFx.Result),
		),
	);
});
