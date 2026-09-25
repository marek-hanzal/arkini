import { Effect, Option } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace setLineSelectionFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly selection: "default";
		readonly lineUid: IdSchema.Type | null;
	}
}

/** Changes the owner's manual default without touching already accepted work. */
export const setLineSelectionFx = Effect.fn("setLineSelectionFx")(function* ({
	ownerItemId,
	lineUid,
}: setLineSelectionFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (owner === undefined)
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			const ownerItem = Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
			if (ownerItem === undefined)
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			if (lineUid !== null) {
				const line = ownerItem.lines.find((candidate) => candidate.uid === lineUid);
				if (line === undefined)
					return yield* Effect.fail(
						new LineNotFoundError({
							itemId: ownerItemId,
							lineUid,
						}),
					);
				if (line.trigger !== LineTriggerEnumSchema.enum.manual)
					return yield* Effect.fail(
						new LineRunUnavailableError({
							ownerItemId,
							lineUid,
						}),
					);
			}
			if (runtime.defaultLineByOwnerItemId[ownerItemId] === lineUid)
				return [
					{
						ownerItemId,
						selection: "default",
						lineUid,
					},
					runtime,
				] as const;
			return [
				{
					ownerItemId,
					selection: "default",
					lineUid,
				},
				{
					...runtime,
					defaultLineByOwnerItemId: {
						...runtime.defaultLineByOwnerItemId,
						[ownerItemId]: lineUid,
					},
				},
			] as const;
		}),
	);
});
