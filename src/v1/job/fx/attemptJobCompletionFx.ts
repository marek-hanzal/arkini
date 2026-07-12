import { Effect } from "effect";

import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import type { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace attemptJobCompletionFx {
	export interface Props {
		job: JobSchema.Type;
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

/** Keeps expected delivery-capacity failures local to one ready job. */
export const attemptJobCompletionFx = Effect.fn("attemptJobCompletionFx")(function* ({
	job,
	runtime,
}: attemptJobCompletionFx.Props) {
	return yield* completeJobRuntimeFx({
		job,
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
