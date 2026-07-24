import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace setDefaultLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}
}

/** Selects one save-backed default line for an exact live line-owner identity. */
export const setDefaultLineFx = Effect.fn("setDefaultLineFx")(function* ({
	ownerItemId,
	lineId,
}: setDefaultLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (owner === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			}
			const ownerItem = Option.getOrUndefined(yield* isLineOwnerItemFx(owner.item));
			const lines =
				ownerItem === undefined ? undefined : yield* readLineOwnerLinesFx(ownerItem);
			if (lines?.some((line) => line.id === lineId) !== true) {
				return yield* Effect.fail(
					new LineNotFoundError({
						itemId: ownerItemId,
						lineId,
					}),
				);
			}
			if (runtime.defaultLineByOwnerItemId?.[ownerItemId] === lineId) {
				return [
					{
						ownerItemId,
						lineId,
					},
					runtime,
				] as const;
			}
			const selectedRuntime = {
				...runtime,
				defaultLineByOwnerItemId: {
					...(runtime.defaultLineByOwnerItemId ?? {}),
					[ownerItemId]: lineId,
				},
			} satisfies RuntimeSchema.Type;
			const isolation = yield* isolateStatefulOwnerTransitionFx({
				ownerItemId,
				runtime: selectedRuntime,
			});
			return [
				{
					ownerItemId,
					lineId,
				},
				isolation.runtime,
				isolation.events,
			] as const;
		}),
	);
});
