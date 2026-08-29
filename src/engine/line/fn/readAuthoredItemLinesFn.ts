import { Option } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { isLineOwnerItemFn } from "~/engine/line/fn/isLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/engine/line/fn/readLineOwnerLinesFn";

/** Projects one authored item to its canonical production-line collection. */
export const readAuthoredItemLinesFn = (item: ItemSchema.Type) => {
	const lineOwner = Option.getOrUndefined(isLineOwnerItemFn(item));
	return lineOwner === undefined ? [] : readLineOwnerLinesFn(lineOwner);
};
