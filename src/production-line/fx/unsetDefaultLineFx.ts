import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { isolateBoardStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateBoardStatefulOwnerTransitionFx";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
					: Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
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
			const isolation = yield* isolateBoardStatefulOwnerTransitionFx({
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
