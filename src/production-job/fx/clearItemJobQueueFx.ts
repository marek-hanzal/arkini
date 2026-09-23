import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { Array, Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { narrowInputRuntimeItemFn } from "~/production-input/fn/narrowInputRuntimeItemFn";
import { returnBufferedLineItemsFx } from "~/production-input/fx/returnBufferedLineItemsFx";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace clearItemJobQueueFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		/** When provided, limits removal to pending requests for this production line. */
		lineId?: IdSchema.Type;
		/** When provided, removes only this exact pending request; a stale identity is a no-op. */
		requestId?: IdSchema.Type;
	}
}

/** Removes one owner's pending work and returns its unused line-input material atomically. */
export const clearItemJobQueueFx = Effect.fn("clearItemJobQueueFx")(function* ({
	ownerItemId,
	lineId,
	requestId,
}: clearItemJobQueueFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* assertItemProductionPlayerControlFx({
				ownerItemId,
				runtime,
			});
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});

			const clearedRequests = runtime.jobQueue.filter(
				(request) =>
					request.ownerItemId === ownerItemId &&
					(lineId === undefined || request.lineId === lineId) &&
					(requestId === undefined || request.id === requestId),
			);
			if (clearedRequests.length === 0) {
				return [
					clearedRequests,
					runtime,
				] as const;
			}

			const clearedIds = new Set(clearedRequests.map((request) => request.id));
			const remainingRequests = runtime.jobQueue.filter(
				(request) => !clearedIds.has(request.id),
			);
			// Buffers belong to the line, so another pending request still needs them.
			const clearedLineIds = new Set(
				clearedRequests
					.filter(
						(request) =>
							!remainingRequests.some(
								(remaining) =>
									remaining.ownerItemId === ownerItemId &&
									remaining.lineId === request.lineId,
							),
					)
					.map((request) => request.lineId),
			);
			let nextRuntime = {
				...runtime,
				jobQueue: remainingRequests,
			} satisfies RuntimeSchema.Type;
			const bufferedItems = Array.getSomes(
				runtime.items.map(narrowInputRuntimeItemFn),
			).filter(
				(item) =>
					item.location.ownerItemId === ownerItemId &&
					clearedLineIds.has(item.location.lineId),
			);
			const returned =
				bufferedItems.length === 0
					? {
							events: [],
							runtime: nextRuntime,
						}
					: yield* Option.match(narrowBoardRuntimeItemFn(owner), {
							onNone: () =>
								Effect.fail(
									new ItemNotOnBoardError({
										itemId: owner.id,
										location: owner.location,
									}),
								),
							onSome: (boardOwner) =>
								returnBufferedLineItemsFx({
									items: bufferedItems,
									owner: boardOwner,
									runtime: nextRuntime,
								}),
						});
			nextRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
				returnLineIdsByOwnerItemId: new Map([
					[
						ownerItemId,
						clearedLineIds,
					],
				]),
				runtime: returned.runtime,
			});

			return [
				clearedRequests,
				nextRuntime,
				[
					{
						type: "job-queue:cleared",
						ownerItemId,
						itemUid: owner.item.uid,
						clearedRequestCount: clearedRequests.length,
					},
					...returned.events,
				],
			] as const;
		}),
	);
});
