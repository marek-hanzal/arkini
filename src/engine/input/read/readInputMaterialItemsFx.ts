import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { getItemsFx } from "~/engine/runtime/read/getItemsFx";
import { isInputRuntimeItem } from "~/engine/runtime/read/isInputRuntimeItem";

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

	return items.filter(isInputRuntimeItem).filter((item) => {
		return (
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === lineId &&
			item.location.inputIndex === inputIndex
		);
	});
});
