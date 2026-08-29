import { useEffect, useState } from "react";

import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { EditorItemFlowSearch } from "~/flow/ui/EditorItemFlowSearch";
import { OriginFlow } from "~/flow/ui/OriginFlow";
import { useEditorItemSearchOptions } from "~/ui/item/useEditorItemSearchOptions";
import type { OriginFlowDirection } from "~/flow/ui/Highlight";

const readGraphFilterDescription = (direction: OriginFlowDirection) =>
	direction === "input"
		? "Search selects an item; Input highlights downstream operations that use it."
		: "Search selects an item; Output highlights upstream operations that produce it.";

/** Shows the complete authored game graph and lets search navigate to one selected item. */
export const EditorGameFlow = ({
	direction,
	itemId = "",
	projectId,
	onDirectionChange,
	onItemIdChange,
}: {
	readonly direction: OriginFlowDirection;
	readonly itemId?: string;
	readonly projectId: string;
	readonly onDirectionChange: (direction: OriginFlowDirection) => void;
	readonly onItemIdChange: (itemId: string) => Promise<void>;
}) => {
	const [focusRequestKey, setFocusRequestKey] = useState(0);
	const { items, options } = useEditorItemSearchOptions();
	useEffect(() => {
		setFocusRequestKey((current) => current + 1);
	}, [
		itemId,
	]);
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 p-3"
			data-ui="EditorGameFlow"
		>
			<div className="grid min-w-0 gap-1.5">
				<div className="flex min-w-0 items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<EditorHistoryBackButton
							params={{
								projectId,
							}}
							to="/editor/$projectId/editor/items/list"
						/>
						<span className="flex min-w-0 items-center gap-1 text-sm">
							<span className="font-semibold text-foreground">Flow</span>
							<EditorInfoTooltip content={readGraphFilterDescription(direction)} />
						</span>
					</div>
					<span className="shrink-0 rounded-full border border-line-strong bg-surface-raised px-3 py-1 text-xs font-semibold text-muted">
						{options.length} items
					</span>
				</div>
				<div className="flex min-w-0 items-end gap-2">
					<div className="min-w-0 flex-1">
						<EditorItemFlowSearch
							items={items}
							onChange={(value) => void onItemIdChange(value)}
							options={options}
							value={itemId}
						/>
					</div>
					<div
						aria-label="Flow direction"
						className="inline-flex shrink-0 gap-1"
						role="group"
					>
						{(
							[
								"input",
								"output",
							] as const
						).map((value) => (
							<button
								aria-pressed={direction === value}
								className={`min-h-[var(--ak-control-min-height)] cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold ${direction === value ? selectableActiveClassName : selectableInactiveClassName}`}
								key={value}
								onClick={() => onDirectionChange(value)}
								type="button"
							>
								{value === "input" ? "Input" : "Output"}
							</button>
						))}
					</div>
				</div>
			</div>
			<OriginFlow
				direction={direction}
				focusItemId={itemId || undefined}
				focusRequestKey={focusRequestKey}
				onFocusItemChange={onItemIdChange}
			/>
		</section>
	);
};
