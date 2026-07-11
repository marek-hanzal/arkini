import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { filterInputMaterialItems } from "./filterInputMaterialItems";

export namespace readInputMaterialItemsFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Reads every runtime material buffered by one concrete product-line input.
 */
export const readInputMaterialItemsFx = Effect.fn("readInputMaterialItemsFx")(function* ({
	ownerItemId,
	lineId,
	inputIndex,
}: readInputMaterialItemsFx.Props) {
	const items = yield* getItemsFx();

	return filterInputMaterialItems({
		inputIndex,
		items,
		lineId,
		ownerItemId,
	});
});
