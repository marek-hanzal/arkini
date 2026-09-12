import { match, P } from "ts-pattern";

import type { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Reads the canonical authored lines owned by one exact line-capable item. */
export const readLineOwnerLinesFn = (item: narrowLineOwnerItemFn.Result) =>
	match(item)

		.with(
			{
				type: P.union(TypeSchema.enum.Common, TypeSchema.enum.Clock),
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
		.exhaustive();
