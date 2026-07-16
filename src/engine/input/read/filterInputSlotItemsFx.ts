import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { readInputSlotLocationFx } from "./readInputSlotLocationFx";

export namespace filterInputSlotItemsFx {
	export interface Props {
		inputIndex: NonNegativeIntegerSchema.Type;
		items: RuntimeItemSchema.Type[];
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
	}
}

/** Filters buffered materials currently occupying one concrete input slot. */
export const filterInputSlotItemsFx = Effect.fn("filterInputSlotItemsFx")(function* ({
	inputIndex,
	items,
	lineId,
	ownerItemId,
}: filterInputSlotItemsFx.Props) {
	return yield* Effect.filter(items, (item) => {
		return readInputSlotLocationFx({
			item,
		}).pipe(
			Effect.map((location) => {
				return (
					location?.ownerItemId === ownerItemId &&
					location.lineId === lineId &&
					location.inputIndex === inputIndex
				);
			}),
		);
	});
});
