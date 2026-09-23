import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

export namespace filterInputSlotItemsFn {
	export interface Props {
		readonly inputIndex: NonNegativeIntegerSchema.Type;
		readonly items: RuntimeItemSchema.Type[];
		readonly lineUid: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Filters buffered materials currently occupying one concrete input slot. */
export const filterInputSlotItemsFn = ({
	inputIndex,
	items,
	lineUid,
	ownerItemId,
}: filterInputSlotItemsFn.Props) =>
	items.filter((item) => {
		return (
			item.location.scope === LocationScopeEnumSchema.enum.Input &&
			item.location.ownerItemId === ownerItemId &&
			item.location.lineUid === lineUid &&
			item.location.inputIndex === inputIndex
		);
	});
