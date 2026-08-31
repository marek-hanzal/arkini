import { Option } from "effect";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";

/** Projects one authored item to its canonical production-line collection. */
export const readAuthoredItemLinesFn = (item: ItemSchema.Type) => {
	const lineOwner = Option.getOrUndefined(narrowLineOwnerItemFn(item));
	return lineOwner === undefined ? [] : readLineOwnerLinesFn(lineOwner);
};
