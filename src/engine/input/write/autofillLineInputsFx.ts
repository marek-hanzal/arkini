import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { applyInputMaterialStorePlanFx } from "~/engine/input/fx/applyInputMaterialStorePlanFx";
import { planLineInputAutofillFx } from "~/engine/input/fx/planLineInputAutofillFx";
import { readItemMaterialInputFx } from "~/engine/input/read/readItemMaterialInputFx";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";

export namespace autofillLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}

	export interface Result {
		readonly storedQuantity: number;
		readonly remainingMissingQuantity: number;
	}
}

/** Atomically fills one line's missing material minimum from canonical eligible grids. */
export const autofillLineInputsFx = Effect.fn("autofillLineInputsFx")(function* ({
	ownerItemId,
	lineId,
}: autofillLineInputsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const plan = yield* planLineInputAutofillFx({
				ownerItemId,
				lineId,
				runtime,
			});
			if (plan.entry.length === 0) {
				return [
					{
						storedQuantity: 0,
						remainingMissingQuantity: plan.remainingMissingQuantity,
					} satisfies autofillLineInputsFx.Result,
					runtime,
				] as const;
			}

			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			let draft = runtime;
			for (const entry of plan.entry) {
				const source = yield* readRuntimeItemByIdFx({
					itemId: entry.sourceItemId,
					runtime: draft,
				});
				if (!isGridRuntimeItem(source)) {
					return yield* Effect.fail(
						new ItemNotOnGridError({
							itemId: source.id,
							location: source.location,
						}),
					);
				}
				yield* readItemMaterialInputFx({
					inputIndex: entry.inputIndex,
					item: owner.item,
					lineId,
					ownerItemId,
				});
				const [, nextDraft] = yield* applyInputMaterialStorePlanFx({
					location: {
						scope: "input",
						ownerItemId,
						lineId,
						inputIndex: entry.inputIndex,
					},
					plan: {
						sourceItemId: source.id,
						quantity: entry.quantity,
					},
					runtime: draft,
					source,
				});
				draft = nextDraft;
			}

			const isolation = yield* isolateStatefulOwnerTransitionFx({
				ownerItemId,
				runtime: draft,
			});
			return [
				{
					storedQuantity: plan.storedQuantity,
					remainingMissingQuantity: plan.remainingMissingQuantity,
				} satisfies autofillLineInputsFx.Result,
				isolation.runtime,
				isolation.events,
			] as const;
		}),
	);
});
