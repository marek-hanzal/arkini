import { Effect } from "effect";

import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemChargesUnavailableError } from "~/engine/item/error/ItemChargesUnavailableError";
import type { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import type { JobOutputMaxCountError } from "~/engine/job/error/JobOutputMaxCountError";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { LineRunUnavailableError } from "~/engine/line/error/LineRunUnavailableError";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { startLineRuntimeFx } from "./startLineRuntimeFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

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
				error:
					| ItemChargesUnavailableError
					| ItemNotOnBoardError
					| JobOutputMaxCountError
					| LineRunUnavailableError
					| PlacementUnavailableError;
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: typeof StartLineResultEnumSchema.enum.Started;
				events: readonly GameEventSchema.Type[];
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
			([job, nextRuntime, events]) =>
				({
					type: StartLineResultEnumSchema.enum.Started,
					events,
					job,
					runtime: nextRuntime,
				}) satisfies attemptQueuedLineStartFx.Result,
		),
		Effect.catchTags({
			ItemChargesUnavailableError: (error) =>
				Effect.succeed({
					type: "blocked",
					error,
					runtime,
				} satisfies attemptQueuedLineStartFx.Result),
			PlacementUnavailableError: (error) =>
				Effect.succeed({
					type: "blocked",
					error,
					runtime,
				} satisfies attemptQueuedLineStartFx.Result),
			JobOutputMaxCountError: (error) =>
				Effect.succeed({
					type: "blocked",
					error,
					runtime,
				} satisfies attemptQueuedLineStartFx.Result),
			LineRunUnavailableError: (error) =>
				Effect.succeed({
					type: "blocked",
					error,
					runtime,
				} satisfies attemptQueuedLineStartFx.Result),
			ItemNotOnBoardError: (error) =>
				error.location.scope === LocationScopeEnumSchema.enum.Inventory ||
				error.location.scope === LocationScopeEnumSchema.enum.Toolbar
					? Effect.succeed({
							type: "blocked",
							error,
							runtime,
						} satisfies attemptQueuedLineStartFx.Result)
					: Effect.fail(error),
		}),
	);
});
