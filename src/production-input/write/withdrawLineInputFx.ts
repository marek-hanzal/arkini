import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";
import { LineInputEmptyError } from "~/production-input/error/LineInputEmptyError";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { readItemMaterialInputFx } from "~/production-input/read/readItemMaterialInputFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { returnBufferedLineItemsFx } from "./returnBufferedLineItemsFx";

export namespace withdrawLineInputFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: NonNegativeIntegerSchema.Type;
	}

	export interface Result {
		readonly withdrawnItemCount: number;
		readonly withdrawnQuantity: number;
	}
}

/** Returns one input's buffered roots while preserving its owner's pending queue intent. */
export const withdrawLineInputFx = Effect.fn("withdrawLineInputFx")(function* ({
	ownerItemId,
	lineId,
	inputIndex,
}: withdrawLineInputFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const { owner } = yield* readBoardItemLineFx({
				ownerItemId,
				lineId,
				runtime,
			});
			yield* readItemMaterialInputFx({
				inputIndex,
				item: owner.item,
				lineId,
				ownerItemId,
			});
			const bufferedItems = filterInputSlotItemsFn({
				inputIndex,
				items: runtime.items,
				lineId,
				ownerItemId,
			});
			if (bufferedItems.length === 0) {
				return yield* Effect.fail(
					new LineInputEmptyError({
						ownerItemId,
						lineId,
						inputIndex,
					}),
				);
			}

			const returned = yield* returnBufferedLineItemsFx({
				items: bufferedItems,
				owner,
				runtime,
			});

			return [
				{
					withdrawnItemCount: returned.withdrawnItemCount,
					withdrawnQuantity: returned.withdrawnQuantity,
				} satisfies withdrawLineInputFx.Result,
				returned.runtime,
				returned.events,
			] as const;
		}),
	);
});
