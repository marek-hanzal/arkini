import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { isInputRuntimeItem } from "~/v1/runtime/read/isInputRuntimeItem";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace filterInputMaterialItems {
	export interface Props {
		inputIndex: NonNegativeIntegerSchema.Type;
		items: RuntimeItemSchema.Type[];
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
	}
}

/**
 * Filters one runtime item collection to one concrete material input slot.
 */
export const filterInputMaterialItems = ({
	inputIndex,
	items,
	lineId,
	ownerItemId,
}: filterInputMaterialItems.Props) => {
	return items.filter(isInputRuntimeItem).filter((item) => {
		return (
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === lineId &&
			item.location.inputIndex === inputIndex
		);
	}) satisfies InputRuntimeItemSchema.Type[];
};
