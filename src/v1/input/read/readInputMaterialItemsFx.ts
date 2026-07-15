import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { getItemsFx } from "~/v1/runtime/read/getItemsFx";
import { isInputRuntimeItem } from "~/v1/runtime/read/isInputRuntimeItem";

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
