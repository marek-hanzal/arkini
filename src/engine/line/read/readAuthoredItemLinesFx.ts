import { Effect, Option } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";

/** Projects one authored item to its canonical production-line collection. */
export const readAuthoredItemLinesFx = Effect.fn("readAuthoredItemLinesFx")(function* (
	item: ItemSchema.Type,
) {
	const lineOwner = Option.getOrUndefined(yield* isLineOwnerItemFx(item));
	return lineOwner === undefined ? [] : yield* readLineOwnerLinesFx(lineOwner);
});
