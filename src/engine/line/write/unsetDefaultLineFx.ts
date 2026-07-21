import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace unsetDefaultLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Removes the save-backed default line from one exact live line-owner identity. */
export const unsetDefaultLineFx = Effect.fn("unsetDefaultLineFx")(function* ({
	ownerItemId,
}: unsetDefaultLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (owner === undefined || !isLineOwnerItem(owner.item)) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			}
			if (runtime.defaultLineByOwnerItemId?.[ownerItemId] === undefined) {
				return [
					{
						ownerItemId,
					},
					runtime,
				] as const;
			}
			const defaultLineByOwnerItemId = {
				...(runtime.defaultLineByOwnerItemId ?? {}),
			};
			delete defaultLineByOwnerItemId[ownerItemId];
			const nextRuntime = {
				...runtime,
				...(Object.keys(defaultLineByOwnerItemId).length === 0
					? {
							defaultLineByOwnerItemId: undefined,
						}
					: {
							defaultLineByOwnerItemId,
						}),
			} satisfies RuntimeSchema.Type;
			return [
				{
					ownerItemId,
				},
				nextRuntime,
			] as const;
		}),
	);
});
