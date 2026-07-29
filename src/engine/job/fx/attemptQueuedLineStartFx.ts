import { Effect } from "effect";

import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemChargesUnavailableError } from "~/engine/item/error/ItemChargesUnavailableError";
import type { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import type { JobOutputMaxCountError } from "~/engine/job/error/JobOutputMaxCountError";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { LineRunUnavailableError } from "~/engine/line/error/LineRunUnavailableError";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { fillAndStartLineRuntimeFx } from "./fillAndStartLineRuntimeFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace attemptQueuedLineStartFx {
	export interface Props {
		requestId: IdSchema.Type;
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

/**
 * Starts one exact live FIFO head or classifies a transient block.
 *
 * The request is removed only from the immutable start candidate. Any rejected start returns the
 * original runtime with the exact row intact.
 */
export const attemptQueuedLineStartFx = Effect.fn("attemptQueuedLineStartFx")(function* ({
	requestId,
	runtime,
}: attemptQueuedLineStartFx.Props) {
	const request = (runtime.jobQueue ?? []).find((candidate) => candidate.id === requestId);
	if (request === undefined)
		return {
			type: "empty",
			runtime,
		} satisfies attemptQueuedLineStartFx.Result;
	const ownerHead = (runtime.jobQueue ?? []).find(
		(candidate) => candidate.ownerItemId === request.ownerItemId,
	);
	if (ownerHead?.id !== request.id) {
		return {
			type: "empty",
			runtime,
		} satisfies attemptQueuedLineStartFx.Result;
	}

	return yield* fillAndStartLineRuntimeFx({
		ownerItemId: request.ownerItemId,
		lineId: request.lineId,
		queueRequestId: request.id,
		runtime,
	}).pipe(
		Effect.map((result): attemptQueuedLineStartFx.Result => {
			if (result.type === "queue-request-unavailable") {
				return {
					type: "empty",
					runtime,
				};
			}
			if (result.type === "incomplete") {
				return {
					type: "blocked",
					error: new LineRunUnavailableError({
						ownerItemId: request.ownerItemId,
						lineId: request.lineId,
					}),
					runtime,
				};
			}
			return {
				type: StartLineResultEnumSchema.enum.Started,
				events: result.events,
				job: result.job,
				runtime: result.runtime,
			};
		}),
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
