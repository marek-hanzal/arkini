import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { Effect } from "effect";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { ItemStatefulError } from "~/game-runtime/error/ItemStatefulError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { LineInputEmptyError } from "~/production-input/error/LineInputEmptyError";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { readItemMaterialInputFx } from "~/production-input/fx/readItemMaterialInputFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { returnBufferedLineItemsFx } from "./returnBufferedLineItemsFx";

export namespace withdrawLineInputFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: NonNegativeIntegerSchema.Type;
		readonly amount?: "one" | "all";
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
	amount = "all",
}: withdrawLineInputFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* assertItemProductionPlayerControlFx({
				ownerItemId,
				runtime,
			});
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

			const first = bufferedItems[0];
			if (amount === "one" && first.quantity > 1) {
				if (
					!isItemPureFn({
						item: first,
						runtime,
					})
				)
					return yield* Effect.fail(
						new ItemStatefulError({
							itemId: first.id,
						}),
					);
				const remainder = yield* reviseRuntimeItemFx({
					item: {
						...first,
						quantity: first.quantity - 1,
					},
				});
				const [placement, nextRuntime] = yield* applyOutputPlacementFx({
					origin: owner.location,
					output: {
						drop: [
							{
								itemId: first.item.id,
								placement: "drop",
								quantity: 1,
							},
						],
					},
					runtime: {
						...runtime,
						items: runtime.items.map((item) =>
							item.id === first.id ? remainder : item,
						),
					},
				});
				return [
					{
						withdrawnItemCount: 1,
						withdrawnQuantity: 1,
					} satisfies withdrawLineInputFx.Result,
					nextRuntime,
					yield* readOutputPlacementItemEventsFx({
						originItemId: owner.id,
						placement,
					}),
				] as const;
			}
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
