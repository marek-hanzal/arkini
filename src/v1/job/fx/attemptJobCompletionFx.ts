import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import type { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
				runtime: RuntimeSchema.Type;
		  };
}

const isExpectedCompletionBlock = (error: PlacementUnavailableError) => {
	switch (error.reason) {
		case "board:full":
		case "inventory:full":
		case "item:max-count":
			return true;
		case "replace:board-forbidden":
		case "replace:origin-not-board":
			return false;
	}
};

/** Resolves one live ready job and keeps only expected delivery failures local. */
export const attemptJobCompletionFx = Effect.fn("attemptJobCompletionFx")(function* ({
	jobId,
	runtime,
}: attemptJobCompletionFx.Props) {
	return yield* completeJobRuntimeFx({
		jobId,
		runtime,
	}).pipe(
		Effect.map(
			(nextRuntime) =>
				({
					type: "completed",
					runtime: nextRuntime,
				}) satisfies attemptJobCompletionFx.Result,
		),
		Effect.catchTag("PlacementUnavailableError", (error) => {
			if (!isExpectedCompletionBlock(error)) {
				return Effect.fail(error);
			}

			return Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies attemptJobCompletionFx.Result);
		}),
	);
});
