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
	}
}

/** Removes one owner's pending work and returns its unused line-input material atomically. */
export const clearItemJobQueueFx = Effect.fn("clearItemJobQueueFx")(function* ({
	ownerItemId,
}: clearItemJobQueueFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});

			const clearedRequests = runtime.jobQueue.filter(
				(request) => request.ownerItemId === ownerItemId,
			);
			if (clearedRequests.length === 0) {
				return [
					clearedRequests,
					runtime,
				] as const;
			}

			const clearedLineIds = new Set(clearedRequests.map((request) => request.lineId));
			let nextRuntime = {
				...runtime,
				jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== ownerItemId),
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
				returned.events,
			] as const;
		}),
	);
});
