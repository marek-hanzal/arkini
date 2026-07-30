import { Effect } from "effect";
import { match } from "ts-pattern";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";

/** Reads the canonical authored lines owned by one exact line-capable item. */
export const readLineOwnerLinesFx = Effect.fn("readLineOwnerLinesFx")(function* (
	item: isLineOwnerItemFx.Result,
) {
	return match(item)
		.with(
			{
				type: ItemEnumSchema.enum.Deposit,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: ItemEnumSchema.enum.Producer,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: ItemEnumSchema.enum.Blueprint,
			},
			({ line }) => [
				line,
			],
		)
		.with(
			{
				type: ItemEnumSchema.enum.Craft,
			},
			({ line }) => [
				line,
			],
		)
		.with(
			{
				type: ItemEnumSchema.enum.Stash,
			},
			({ line }) => [
				line,
			],
		)
		.exhaustive();
});
