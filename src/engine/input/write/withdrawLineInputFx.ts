import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { LineInputEmptyError } from "~/engine/input/error/LineInputEmptyError";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { readItemMaterialInputFx } from "~/engine/input/read/readItemMaterialInputFx";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

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

/** Atomically returns every buffered root from one exact material input through standard placement. */
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
			const bufferedItems = yield* filterInputSlotItemsFx({
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

			let draft = runtime;
			const events: GameEventSchema.Type[] = [];
			for (const bufferedItem of bufferedItems) {
				const placement = yield* placeRuntimeItemFx({
					itemId: bufferedItem.id,
					origin: owner.location,
					originItemId: owner.id,
					runtime: draft,
				});
				events.push(...placement.events);
				draft = placement.runtime;
			}

			return [
				{
					withdrawnItemCount: bufferedItems.length,
					withdrawnQuantity: bufferedItems.reduce(
						(total, item) => total + item.quantity,
						0,
					),
				} satisfies withdrawLineInputFx.Result,
				draft,
				events,
			] as const;
		}),
	);
});
