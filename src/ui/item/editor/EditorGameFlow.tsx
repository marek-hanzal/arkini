import { useState } from "react";

import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { EditorOriginFlowSection } from "~/ui/item/editor/EditorItemFlowSection";
import { EditorItemSearchThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import type { EditorOriginFlowDirection } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { Tooltip } from "~/ui/overlay/Tooltip";

const readGraphFilterDescription = (direction: EditorOriginFlowDirection) =>
	direction === "income"
		? "Search selects an item; Income highlights everything required to obtain it."
		: "Search selects an item; Outcome highlights everything that depends on it.";

/** Shows the complete authored game graph and lets search navigate to one selected item. */
export const EditorGameFlow = () => {
	const [itemId, setItemId] = useState("");
	const [direction, setDirection] = useState<EditorOriginFlowDirection>("income");
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
						<EditorInfoTooltip content={readGraphFilterDescription(direction)} />
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
						<Tooltip content="Clear search">
							<button
								type="button"
								className="grid min-h-[var(--ak-control-min-height)] min-w-[var(--ak-control-min-height)] cursor-pointer place-items-center rounded-lg border border-line-strong bg-surface-raised text-muted hover:text-foreground"
								onClick={() => setItemId("")}
							>
								<span className="icon-[lucide--x] size-5" />
							</button>
						</Tooltip>
					)}
					<div
						aria-label="Flow direction"
						className="inline-flex min-h-[var(--ak-control-min-height)] shrink-0 rounded-lg border border-line bg-surface p-1"
						role="group"
					>
						{(
							[
								"income",
								"outcome",
							] as const
						).map((value) => (
							<button
								aria-pressed={direction === value}
								className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold ${direction === value ? selectableActiveClassName : selectableInactiveClassName}`}
								key={value}
								onClick={() => setDirection(value)}
								type="button"
							>
								{value === "income" ? "Income" : "Outcome"}
							</button>
						))}
					</div>
				</div>
			</div>
			<EditorOriginFlowSection
				direction={direction}
				focusItemId={itemId || undefined}
				mode="all"
			/>
		</section>
	);
};
