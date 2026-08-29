import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemChargesUnavailableError } from "~/engine/item/error/ItemChargesUnavailableError";
import type { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import type { OutputCapacityError } from "~/production-job/error/OutputCapacityError";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { autofillLineInputsRuntimeFx } from "~/production-input/write/autofillLineInputsRuntimeFx";
import { startQueuedLineRuntimeFx } from "./startQueuedLineRuntimeFx";
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
					| OutputCapacityError
					| LineRunUnavailableError
					| PlacementUnavailableError;
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "delivery-scheduled";
				events: readonly GameEventSchema.Type[];
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "started";
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
	const request = runtime.jobQueue.find((candidate) => candidate.id === requestId);
	if (request === undefined)
		return {
			type: "empty",
			runtime,
		} satisfies attemptQueuedLineStartFx.Result;
	const ownerHead = runtime.jobQueue.find(
		(candidate) => candidate.ownerItemId === request.ownerItemId,
	);
	if (ownerHead?.id !== request.id) {
		return {
			type: "empty",
			runtime,
		} satisfies attemptQueuedLineStartFx.Result;
	}

	return yield* Effect.gen(function* () {
		const result = yield* startQueuedLineRuntimeFx({
			ownerItemId: request.ownerItemId,
			lineId: request.lineId,
			queueRequestId: request.id,
			runtime,
		});
		if (result.type === "queue-request-unavailable") {
			return {
				type: "empty",
				runtime,
			} satisfies attemptQueuedLineStartFx.Result;
		}
		if (result.type === "incomplete") {
			const autofill = yield* autofillLineInputsRuntimeFx({
				ownerItemId: request.ownerItemId,
				lineId: request.lineId,
				runtime,
			});
			if (autofill.result.scheduledQuantity > 0) {
				return {
					type: "delivery-scheduled",
					events: autofill.events,
					runtime: autofill.runtime,
				} satisfies attemptQueuedLineStartFx.Result;
			}
			return {
				type: "blocked",
				error: new LineRunUnavailableError({
					ownerItemId: request.ownerItemId,
					lineId: request.lineId,
				}),
				runtime,
			} satisfies attemptQueuedLineStartFx.Result;
		}
		return {
			type: "started",
			events: result.events,
			job: result.job,
			runtime: result.runtime,
		} satisfies attemptQueuedLineStartFx.Result;
	}).pipe(
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
			OutputCapacityError: (error) =>
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
