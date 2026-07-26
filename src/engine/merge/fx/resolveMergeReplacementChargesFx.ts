import { Effect } from "effect";

import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveMergeReplacementChargesFx {
	export interface Props {
		readonly resultItem: ItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly target: BoardRuntimeItemSchema.Type;
	}

	export interface Result {
		readonly remainingCharges?: number;
	}
}

/**
 * Carries compatible charge wear through an identity-changing merge replacement.
 *
 * Replacement still rejects every other identity-owned state. A partially spent charged item may
 * only become another charged item, preserving the number of charges already spent instead of
 * silently refilling or discarding its lifetime.
 */
export const resolveMergeReplacementChargesFx = Effect.fn("resolveMergeReplacementChargesFx")(
	function* ({ resultItem, runtime, target }: resolveMergeReplacementChargesFx.Props) {
		const otherwisePure = yield* isItemPureFx({
			item: {
				...target,
				remainingCharges: undefined,
			},
			runtime,
		});
		if (!otherwisePure) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: target.id,
				}),
			);
		}
		if (target.remainingCharges === undefined) {
			return {} satisfies resolveMergeReplacementChargesFx.Result;
		}

		const targetCapacity = target.item.charges?.amount;
		const resultCapacity = resultItem.charges?.amount;
		if (targetCapacity === undefined || resultCapacity === undefined || target.quantity !== 1) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: target.id,
				}),
			);
		}
		const remainingCharges = resultCapacity - (targetCapacity - target.remainingCharges);
		if (remainingCharges <= 0) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: target.id,
				}),
			);
		}

		return {
			...(remainingCharges === resultCapacity
				? {}
				: {
						remainingCharges,
					}),
		} satisfies resolveMergeReplacementChargesFx.Result;
	},
);
