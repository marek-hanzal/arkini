import { match } from "ts-pattern";

import type { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Reads the canonical authored lines owned by one exact line-capable item. */
export const readLineOwnerLinesFn = (item: isLineOwnerItemFn.Result) =>
	match(item)
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
