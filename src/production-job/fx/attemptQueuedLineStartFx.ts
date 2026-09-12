import { Effect } from "effect";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemUnitsUnavailableError } from "~/production-action/error/ItemUnitsUnavailableError";
import type { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { OutputCapacityError } from "~/production-job/error/OutputCapacityError";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { autofillLineInputsRuntimeFx } from "~/production-input/fx/autofillLineInputsRuntimeFx";
import { startQueuedLineRuntimeFx } from "./startQueuedLineRuntimeFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

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
					| ItemUnitsUnavailableError
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
 * Attempts one exact live request or classifies a transient block.
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
			const owner = runtime.items.find((item) => item.id === request.ownerItemId);
			if (owner !== undefined && !isItemProductionAdmissionOpenFn(owner))
				return {
					type: "blocked",
					runtime,
					error: new LineRunUnavailableError({
						ownerItemId: request.ownerItemId,
						lineId: request.lineId,
					}),
				} as const;
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
			ItemUnitsUnavailableError: (error) =>
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
