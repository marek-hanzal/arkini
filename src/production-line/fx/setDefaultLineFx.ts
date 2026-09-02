import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { isolateBoardStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateBoardStatefulOwnerTransitionFx";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
			const ownerItem = Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
			const lines = ownerItem === undefined ? undefined : readLineOwnerLinesFn(ownerItem);
			if (lines?.some((line) => line.id === lineId) !== true) {
				return yield* Effect.fail(
					new LineNotFoundError({
						itemId: ownerItemId,
						lineId,
					}),
				);
			}
			if (runtime.defaultLineByOwnerItemId[ownerItemId] === lineId) {
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
					...runtime.defaultLineByOwnerItemId,
					[ownerItemId]: lineId,
				},
			} satisfies RuntimeSchema.Type;
			const isolation = yield* isolateBoardStatefulOwnerTransitionFx({
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
