import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { LineRunUnavailableError } from "~/v1/line/error/LineRunUnavailableError";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { startLineRuntimeFx } from "./startLineRuntimeFx";

export namespace attemptQueuedLineStartFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				type: "empty";
				runtime: RuntimeSchema.Type;
		  }
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

/** Resolves one owner's live FIFO head and starts it or classifies a transient block. */
export const attemptQueuedLineStartFx = Effect.fn("attemptQueuedLineStartFx")(function* ({
	ownerItemId,
	runtime,
}: attemptQueuedLineStartFx.Props) {
	const request = (runtime.jobQueue ?? []).find(
		(candidate) => candidate.ownerItemId === ownerItemId,
	);
	if (request === undefined)
		return {
			type: "empty",
			runtime,
		} satisfies attemptQueuedLineStartFx.Result;

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
