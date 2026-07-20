import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isInputRuntimeItem } from "~/engine/runtime/read/isInputRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";

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
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			if (!isBoardRuntimeItem(owner)) {
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: owner.id,
						location: owner.location,
					}),
				);
			}
			const line = yield* readItemLineFx({
				item: owner.item,
				lineId,
			});
			if (line === undefined) {
				return yield* Effect.fail(
					new LineNotFoundError({
						itemId: owner.id,
						lineId,
					}),
				);
			}

			const bufferedItems = runtime.items.filter(
				(item) =>
					isInputRuntimeItem(item) &&
					item.location.ownerItemId === ownerItemId &&
					item.location.lineId === lineId,
			);
			let draft = runtime;
			for (const bufferedItem of bufferedItems) {
				draft = yield* placeRuntimeItemFx({
					itemId: bufferedItem.id,
					origin: owner.location,
					runtime: draft,
				});
			}

			return [
				{
					withdrawnItemCount: bufferedItems.length,
					withdrawnQuantity: bufferedItems.reduce(
						(total, item) => total + item.quantity,
						0,
					),
				} satisfies withdrawLineInputsFx.Result,
				draft,
			] as const;
		}),
	);
});
