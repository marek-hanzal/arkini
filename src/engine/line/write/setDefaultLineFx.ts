import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
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
			if (
				!isLineOwnerItem(owner.item) ||
				!readLineOwnerLines(owner.item).some((line) => line.id === lineId)
			) {
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
			const nextRuntime = {
				...runtime,
				defaultLineByOwnerItemId: {
					...(runtime.defaultLineByOwnerItemId ?? {}),
					[ownerItemId]: lineId,
				},
			} satisfies RuntimeSchema.Type;
			return [
				{
					ownerItemId,
					lineId,
				},
				nextRuntime,
			] as const;
		}),
	);
});
