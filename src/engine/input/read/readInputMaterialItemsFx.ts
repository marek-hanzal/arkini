import { Array, Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isInputRuntimeItemFn } from "~/engine/runtime/read/fn/isInputRuntimeItemFn";

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
	const inputItems = Array.getSomes(items.map(isInputRuntimeItemFn));

	return inputItems.filter((item) => {
		return (
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === lineId &&
			item.location.inputIndex === inputIndex
		);
	});
});
