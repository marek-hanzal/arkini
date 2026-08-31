import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { selectableClassName } from "~/ui/constant/SelectableStateClassName";

/** Selects one authored item type from an item row. */
export const ItemTypeFilterButton = ({
	activeType,
	itemType,
	onSelectTypeFn,
}: {
	readonly activeType: TypeSchema.Type | undefined;
	readonly itemType: TypeSchema.Type;
	readonly onSelectTypeFn: (type: TypeSchema.Type) => void;
}) => (
	<button
		type="button"
		className={`relative z-10 shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${selectableClassName}`}
		onClick={() => onSelectTypeFn(itemType)}
		{...readDataUiFn({
			dataUi: "EditorItemTypeFilter",
			state: {
				selected: activeType === itemType,
			},
		})}
	>
		{itemType}
	</button>
);
