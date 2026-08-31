import { Array, Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { isInputRuntimeItemFn } from "~/production-input/read/fn/isInputRuntimeItemFn";
import { returnBufferedLineItemsFx } from "./returnBufferedLineItemsFx";

export namespace withdrawLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}

	export interface Result {
		readonly withdrawnItemCount: number;
		readonly withdrawnQuantity: number;
	}
}

/** Returns one line's buffered roots while preserving its owner's pending queue intent. */
export const withdrawLineInputsFx = Effect.fn("withdrawLineInputsFx")(function* ({
	ownerItemId,
	lineId,
}: withdrawLineInputsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const { owner } = yield* readBoardItemLineFx({
				ownerItemId,
				lineId,
				runtime,
			});

			const bufferedItems = Array.getSomes(runtime.items.map(isInputRuntimeItemFn)).filter(
				(item) =>
					item.location.ownerItemId === ownerItemId && item.location.lineId === lineId,
			);
			const returned = yield* returnBufferedLineItemsFx({
				items: bufferedItems,
				owner,
				runtime,
			});

			return [
				{
					withdrawnItemCount: returned.withdrawnItemCount,
					withdrawnQuantity: returned.withdrawnQuantity,
				} satisfies withdrawLineInputsFx.Result,
				returned.runtime,
				returned.events,
			] as const;
		}),
	);
});
