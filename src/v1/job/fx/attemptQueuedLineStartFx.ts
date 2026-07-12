import { Effect } from "effect";

import type { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import type { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { LineRunUnavailableError } from "~/v1/line/error/LineRunUnavailableError";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { startLineRuntimeFx } from "./startLineRuntimeFx";

export namespace attemptQueuedLineStartFx {
	export interface Props {
		request: JobQueueRequestSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				type: "blocked";
				error: ItemNotOnBoardError | LineRunUnavailableError;
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "started";
				job: JobSchema.Type;
				runtime: RuntimeSchema.Type;
		  };
}

/** Starts one queued request or classifies only known transient blockers as retryable. */
export const attemptQueuedLineStartFx = Effect.fn("attemptQueuedLineStartFx")(function* ({
	request,
	runtime,
}: attemptQueuedLineStartFx.Props) {
	const withoutRequest = {
		...runtime,
		jobQueue: (runtime.jobQueue ?? []).filter((candidate) => candidate.id !== request.id),
	};

	return yield* startLineRuntimeFx({
		ownerItemId: request.ownerItemId,
		lineId: request.lineId,
		runtime: withoutRequest,
	}).pipe(
		Effect.map(
			([job, nextRuntime]) =>
				({
					type: "started",
					job,
					runtime: nextRuntime,
				}) satisfies attemptQueuedLineStartFx.Result,
		),
		Effect.catchTags({
			LineRunUnavailableError: (error) =>
				Effect.succeed({
					type: "blocked",
					error,
					runtime,
				} satisfies attemptQueuedLineStartFx.Result),
			ItemNotOnBoardError: (error) =>
				error.location.scope === "inventory"
					? Effect.succeed({
							type: "blocked",
							error,
							runtime,
						} satisfies attemptQueuedLineStartFx.Result)
					: Effect.fail(error),
		}),
	);
});
