import { useState } from "react";

import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorItemSearchThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { EditorOriginFlowSection } from "~/ui/item/editor/EditorItemFlowSection";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { Tooltip } from "~/ui/overlay/Tooltip";

const GraphFilterDescription =
	"Choose an item to show only its direct acquisition path back to a starter item. Leave empty to show the complete game graph.";

/** Shows the complete authored game graph and optionally narrows it to one acquisition path. */
export const EditorGameFlow = () => {
	const [itemId, setItemId] = useState("");
	const { items, options } = useEditorItemSearchOptions();
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 p-3"
			data-ui="EditorGameFlow"
		>
			<div className="grid min-w-0 gap-1.5">
				<div className="flex min-w-0 items-center justify-between gap-3">
					<span className="flex min-w-0 items-center gap-1 text-sm">
						<span className="font-semibold text-foreground">Filter graph by item</span>
						<EditorInfoTooltip content={GraphFilterDescription} />
					</span>
					<span className="shrink-0 rounded-full border border-line-strong bg-surface-raised px-3 py-1 text-xs font-semibold text-muted">
						{options.length} items
					</span>
				</div>
				<div className="flex min-w-0 items-end gap-2">
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							description={GraphFilterDescription}
							displaySelectedLabel
							emptyLabel="No known item matches this search."
							label="Filter graph by item"
							labelVisible={false}
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
			</div>
			<EditorOriginFlowSection
				itemId={itemId || undefined}
				mode={itemId.length === 0 ? "all" : "item"}
			/>
		</section>
	);
};
