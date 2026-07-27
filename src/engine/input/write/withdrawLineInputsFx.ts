import { Array, Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isInputRuntimeItemFx } from "~/engine/runtime/read/isInputRuntimeItemFx";
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

/** Atomically returns one line's buffered material roots through standard placement. */
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

			const bufferedItems = Array.getSomes(
				yield* Effect.forEach(runtime.items, isInputRuntimeItemFx),
			).filter(
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
