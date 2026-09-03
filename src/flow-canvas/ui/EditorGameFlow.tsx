import { X } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import {
	type EditorSearchOption,
	EditorSearchCombobox,
} from "~/editor-control/ui/EditorSearchCombobox";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { Tooltip } from "~/ui/ui/Tooltip";
import { useEffect, useState } from "react";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { OriginFlow } from "~/flow-canvas/ui/OriginFlow";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { OriginFlowDirection } from "~/flow-canvas/type/Highlight";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";

interface EditorItemFlowSearchProps {
	readonly items: Readonly<Record<string, ItemSchema.Type>>;
	readonly options: readonly EditorSearchOption[];
	readonly value: string;
	readonly onChangeFn: (value: string) => void;
}

/** Searches the item facts available in one rendered Flow graph. */
const EditorItemFlowSearch = ({ items, onChangeFn, options, value }: EditorItemFlowSearchProps) => (
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
				onChangeFn={onChangeFn}
				renderPreviewFn={(option) => <EditorItemSearchThumbnail item={items[option.id]} />}
				renderSelectedPreviewFn={(option) => (
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
					onClick={() => onChangeFn("")}
				>
					<X className="size-5" />
				</button>
			</Tooltip>
		)}
	</div>
);

/** Shows the complete authored game graph and lets search navigate to one selected item. */
export const EditorGameFlow = ({
	direction,
	itemId = "",
	projectId,
	onDirectionChangeFn,
	onItemIdChangeFn,
}: {
	readonly direction: OriginFlowDirection;
	readonly itemId?: string;
	readonly projectId: string;
	readonly onDirectionChangeFn: (direction: OriginFlowDirection) => void;
	readonly onItemIdChangeFn: (itemId: string) => Promise<void>;
}) => {
	const [focusRequestKey, setFocusRequestKeyFn] = useState(0);
	const { items, options } = useEditorItemSearchOptions();
	useEffect(() => {
		setFocusRequestKeyFn((current) => current + 1);
	}, [
		itemId,
	]);
	return (
		<EditorSectionPage
			contentMode="viewport"
			header={
				<header className="grid min-w-0 grid-cols-[auto_auto_minmax(12rem,1fr)_auto_auto_auto] items-center gap-2">
					<EditorHistoryBackButton
						params={{
							projectId,
						}}
						to="/editor/$projectId/editor/items/list"
					/>
					<h1 className="shrink-0 text-xl font-semibold">
						<Tx label="Flow" />
					</h1>
					<div className="min-w-64 flex-1">
						<EditorItemFlowSearch
							items={items}
							onChangeFn={(value) => void onItemIdChangeFn(value)}
							options={options}
							value={itemId}
						/>
					</div>
					<SegmentedControl
						dataUi="EditorGameFlowDirectionOptions"
						onChangeFn={onDirectionChangeFn}
						optionDataUi="EditorGameFlowDirection"
						options={[
							{
								label: "Input",
								value: "input",
							},
							{
								label: "Output",
								value: "output",
							},
						]}
						value={direction}
					/>
					<span className="shrink-0 rounded-full border border-line-strong bg-surface-raised px-3 py-1 text-xs font-semibold text-muted">
						{options.length} items
					</span>
					<EditorPageHelp
						content={<Mx label="Flow help" />}
						title={<Tx label="Flow" />}
					/>
				</header>
			}
		>
			<div
				className="h-full min-h-0 p-3"
				data-ui="EditorGameFlow"
			>
				<OriginFlow
					direction={direction}
					focusItemId={itemId || undefined}
					focusRequestKey={focusRequestKey}
					onFocusItemChangeFn={onItemIdChangeFn}
				/>
			</div>
		</EditorSectionPage>
	);
};
