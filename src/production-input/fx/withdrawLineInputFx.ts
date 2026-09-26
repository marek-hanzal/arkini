import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { LineInputEmptyError } from "~/production-input/error/LineInputEmptyError";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { readItemMaterialInputFx } from "~/production-input/fx/readItemMaterialInputFx";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { returnBufferedLineItemsFx } from "./returnBufferedLineItemsFx";

export namespace withdrawLineInputFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
		readonly inputIndex: NonNegativeIntegerSchema.Type;
		readonly amount?: "one" | "all";
	}

	export interface Result {
		readonly withdrawnItemCount: number;
	}
}

/** Returns buffered material and cancels pending work that would refill its line. */
export const withdrawLineInputFx = Effect.fn("withdrawLineInputFx")(function* ({
	ownerItemId,
	lineUid,
	inputIndex,
	amount = "all",
}: withdrawLineInputFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const { owner } = yield* readBoardItemLineFx({
				ownerItemId,
				lineUid,
				runtime,
			});
			yield* readItemMaterialInputFx({
				inputIndex,
				item: owner.item,
				lineUid,
				ownerItemId,
			});
			const bufferedItems = filterInputSlotItemsFn({
				inputIndex,
				items: runtime.items,
				lineUid,
				ownerItemId,
			});
			if (bufferedItems.length === 0) {
				return yield* Effect.fail(
					new LineInputEmptyError({
						ownerItemId,
						lineUid,
						inputIndex,
					}),
				);
			}

			const first = bufferedItems[0];

			const returned = yield* returnBufferedLineItemsFx({
				items:
					amount === "one"
						? [
								first,
							]
						: bufferedItems,
				owner,
				runtime,
			});
			const remainingRequests = runtime.jobQueue.filter(
				(request) => request.ownerItemId !== ownerItemId || request.lineUid !== lineUid,
			);
			const clearedRequestCount = runtime.jobQueue.length - remainingRequests.length;
			const nextRuntime =
				clearedRequestCount === 0
					? returned.runtime
					: yield* reconcileOutboundDeliveriesRuntimeFx({
							returnLineUidsByOwnerItemId: new Map([
								[
									ownerItemId,
									new Set([
										lineUid,
									]),
								],
							]),
							runtime: {
								...returned.runtime,
								jobQueue: remainingRequests,
							},
						});

			return [
				{
					withdrawnItemCount: returned.withdrawnItemCount,
				} satisfies withdrawLineInputFx.Result,
				nextRuntime,
				[
					...returned.events,
					...(clearedRequestCount === 0
						? []
						: [
								{
									type: "job-queue:cleared" as const,
									ownerItemId,
									itemUid: owner.item.uid,
									clearedRequestCount,
								},
							]),
				],
			] as const;
		}),
	);
});
