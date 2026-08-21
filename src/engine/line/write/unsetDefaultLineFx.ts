import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace unsetDefaultLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Explicitly disables default-line behavior for one exact live line-owner identity. */
export const unsetDefaultLineFx = Effect.fn("unsetDefaultLineFx")(function* ({
	ownerItemId,
}: unsetDefaultLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			const ownerItem =
				owner === undefined
					? undefined
					: Option.getOrUndefined(yield* isLineOwnerItemFx(owner.item));
			if (ownerItem === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			}
			if (
				Object.hasOwn(runtime.defaultLineByOwnerItemId, ownerItemId) &&
				runtime.defaultLineByOwnerItemId[ownerItemId] === null
			) {
				return [
					{
						ownerItemId,
					},
					runtime,
				] as const;
			}
			const nextRuntime = {
				...runtime,
				defaultLineByOwnerItemId: {
					...runtime.defaultLineByOwnerItemId,
					[ownerItemId]: null,
				},
			} satisfies RuntimeSchema.Type;
			const isolation = yield* isolateStatefulOwnerTransitionFx({
				ownerItemId,
				runtime: nextRuntime,
			});
			return [
				{
					ownerItemId,
				},
				isolation.runtime,
				isolation.events,
			] as const;
		}),
	);
});
