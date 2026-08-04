import { useState } from "react";

import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { EditorOriginFlowSection } from "~/ui/item/editor/EditorItemFlowSection";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { Tooltip } from "~/ui/overlay/Tooltip";

/** Shows the complete authored game graph and optionally narrows it to one acquisition path. */
export const EditorGameFlow = () => {
	const [itemId, setItemId] = useState("");
	const { items, options } = useEditorItemSearchOptions();
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 p-3"
			data-ui="EditorGameFlow"
		>
			<div className="flex min-w-0 items-end gap-2">
				<div className="min-w-0 flex-1">
					<EditorSearchCombobox
						description="Choose an item to show only its direct acquisition path back to a starter item. Leave empty to show the complete game graph."
						displaySelectedLabel
						emptyLabel="No known item matches this search."
						label="Filter graph by item"
						options={options}
						value={itemId}
						onChange={setItemId}
						renderPreview={(option) => (
							<EditorItemSearchThumbnail item={items[option.id]} />
						)}
						renderSelectedPreview={(option) => (
							<EditorItemSearchThumbnail
								item={items[option.id]}
								selected
							/>
						)}
					/>
				</div>
				{itemId.length === 0 ? null : (
					<Tooltip content="Clear the item filter and show the complete game graph.">
						<button
							type="button"
							className="grid min-h-[var(--ak-control-min-height)] min-w-[var(--ak-control-min-height)] cursor-pointer place-items-center rounded-lg border border-line-strong bg-surface-raised text-muted hover:text-foreground"
							onClick={() => setItemId("")}
						>
							<span className="icon-[lucide--filter-x] size-5" />
						</button>
					</Tooltip>
				)}
			</div>
			<EditorOriginFlowSection
				itemId={itemId || undefined}
				mode={itemId.length === 0 ? "all" : "item"}
			/>
		</section>
	);
};
