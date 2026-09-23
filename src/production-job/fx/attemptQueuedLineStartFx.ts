import { Effect } from "effect";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemUnitsUnavailableError } from "~/production-action/error/ItemUnitsUnavailableError";
import type { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { autofillLineInputsRuntimeFx } from "~/production-input/fx/autofillLineInputsRuntimeFx";
import { startQueuedLineRuntimeFx } from "./startQueuedLineRuntimeFx";

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
					| LineRunUnavailableError
					| PlacementUnavailableError;
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "delivery-scheduled";
				facts: readonly EngineFact[];
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "started";
				facts: readonly EngineFact[];
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
			request,
			runtime,
		});
		if (result.type === "incomplete") {
			const owner = runtime.items.find((item) => item.id === request.ownerItemId);
			if (owner !== undefined && !isItemProductionAdmissionOpenFn(owner))
				return {
					type: "blocked",
					runtime,
					error: new LineRunUnavailableError({
						ownerItemId: request.ownerItemId,
						lineUid: request.lineUid,
					}),
				} as const;
			const autofill = yield* autofillLineInputsRuntimeFx({
				ownerItemId: request.ownerItemId,
				lineUid: request.lineUid,
				runtime,
			});
			if (autofill.result.scheduledQuantity > 0) {
				return {
					type: "delivery-scheduled",
					facts: autofill.facts,
					runtime: autofill.runtime,
				} satisfies attemptQueuedLineStartFx.Result;
			}
			return {
				type: "blocked",
				error: new LineRunUnavailableError({
					ownerItemId: request.ownerItemId,
					lineUid: request.lineUid,
				}),
				runtime,
			} satisfies attemptQueuedLineStartFx.Result;
		}
		return {
			type: "started",
			facts: result.facts,
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
			LineRunUnavailableError: (error) =>
				Effect.succeed({
					type: "blocked",
					error,
					runtime,
				} satisfies attemptQueuedLineStartFx.Result),
		}),
	);
});
