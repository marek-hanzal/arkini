import { X } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { type EditorSearchOption, EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/ui/item/EditorItemThumbnail";
import { Tooltip } from "~/ui/overlay/Tooltip";

interface EditorItemFlowSearchProps {
	readonly items: Readonly<Record<string, ItemSchema.Type>>;
	readonly options: readonly EditorSearchOption[];
	readonly value: string;
	readonly onChange: (value: string) => void;
}

/** Searches the item facts available in one rendered Flow graph. */
export const EditorItemFlowSearch = ({
	items,
	onChange,
	options,
	value,
}: EditorItemFlowSearchProps) => (
	<div className="flex min-w-0 items-end gap-2">
		<div className="min-w-0 flex-1">
			<EditorSearchCombobox
				displaySelectedLabel
				emptyLabel="No matches."
				label="Search"
				labelVisible={false}
				options={options}
				placeholder="Search"
				value={value}
				onChange={onChange}
				renderPreview={(option) => <EditorItemSearchThumbnail item={items[option.id]} />}
				renderSelectedPreview={(option) => (
					<EditorItemSearchThumbnail
						item={items[option.id]}
						selected
					/>
				)}
			/>
		</div>
		{value.length === 0 ? null : (
			<Tooltip content="Clear search">
				<button
					type="button"
					className="grid min-h-[var(--ak-control-min-height)] min-w-[var(--ak-control-min-height)] cursor-pointer place-items-center rounded-lg border border-line-strong bg-surface-raised text-muted hover:text-foreground"
					onClick={() => onChange("")}
				>
					<X className="size-5" />
				</button>
			</Tooltip>
		)}
	</div>
);
