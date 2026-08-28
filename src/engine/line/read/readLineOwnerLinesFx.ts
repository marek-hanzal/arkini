import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";

/** Reads the canonical authored lines owned by one exact line-capable item. */
export const readLineOwnerLinesFx = Effect.fn("readLineOwnerLinesFx")(function* (
	item: isLineOwnerItemFx.Result,
) {
	return match(item)
		.with(
			{
				type: TypeSchema.enum.Deposit,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: TypeSchema.enum.Producer,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: TypeSchema.enum.Blueprint,
			},
			({ line }) => [
				line,
			],
		)
		.with(
			{
				type: TypeSchema.enum.Craft,
			},
			({ line }) => [
				line,
			],
		)
		.with(
			{
				type: TypeSchema.enum.Stash,
			},
			({ line }) => [
				line,
			],
		)
		.exhaustive();
});
