import { useState } from "react";

import type { EditorItemOriginFlowDirection } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { EditorItemSearchThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { EditorOriginFlowSection } from "~/ui/item/editor/EditorItemFlowSection";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { Tooltip } from "~/ui/overlay/Tooltip";

const GraphFilterDescription =
	"Choose an item. Income shows what it needs; Outcome shows what it leads to.";

/** Shows the complete authored game graph and optionally narrows it to one acquisition path. */
export const EditorGameFlow = () => {
	const [itemId, setItemId] = useState("");
	const [direction, setDirection] = useState<EditorItemOriginFlowDirection>("income");
	const { items, options } = useEditorItemSearchOptions();
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 p-3"
			data-ui="EditorGameFlow"
		>
			<div className="grid min-w-0 gap-1.5">
				<div className="flex min-w-0 items-center justify-between gap-3">
					<span className="flex min-w-0 items-center gap-1 text-sm">
						<span className="font-semibold text-foreground">Flow</span>
						<EditorInfoTooltip content={GraphFilterDescription} />
					</span>
					<span className="shrink-0 rounded-full border border-line-strong bg-surface-raised px-3 py-1 text-xs font-semibold text-muted">
						{options.length} items
					</span>
				</div>
				<div className="flex min-w-0 items-end gap-2">
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							displaySelectedLabel
							emptyLabel="No matches."
							label="Search"
							labelVisible={false}
							options={options}
							placeholder="Search"
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
						<Tooltip content="Clear filter">
							<button
								type="button"
								className="grid min-h-[var(--ak-control-min-height)] min-w-[var(--ak-control-min-height)] cursor-pointer place-items-center rounded-lg border border-line-strong bg-surface-raised text-muted hover:text-foreground"
								onClick={() => setItemId("")}
							>
								<span className="icon-[lucide--filter-x] size-5" />
							</button>
						</Tooltip>
					)}
					<div
						className="inline-flex min-h-[var(--ak-control-min-height)] shrink-0 rounded-lg border border-line bg-surface p-1"
						aria-label="Flow direction"
						role="group"
					>
						{(
							[
								"income",
								"outcome",
							] as const
						).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={direction === value}
								className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold ${direction === value ? selectableActiveClassName : selectableInactiveClassName}`}
								onClick={() => setDirection(value)}
							>
								{value === "income" ? "Income" : "Outcome"}
							</button>
						))}
					</div>
				</div>
			</div>
			<EditorOriginFlowSection
				direction={itemId.length === 0 ? undefined : direction}
				itemId={itemId || undefined}
				mode={itemId.length === 0 ? "all" : "item"}
			/>
		</section>
	);
};
