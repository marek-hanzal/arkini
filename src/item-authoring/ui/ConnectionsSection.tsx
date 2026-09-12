import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { ChevronRight, Unlink } from "lucide-react";
import { useMemo, useState } from "react";

import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import {
	type EditorSearchOption,
	EditorSearchCombobox,
} from "~/editor-control/ui/EditorSearchCombobox";
import { EditorSelect } from "~/editor-control/ui/EditorSelect";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import { readItemConnectionsFn } from "~/item-authoring/fn/readItemConnectionsFn";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

const ConnectionFilterOptions = [
	{
		label: "Required by",
		value: "required-by",
	},
	{
		label: "Inputs",
		value: "inputs",
	},
	{
		label: "Produces",
		value: "produces",
	},
] as const;

const EmptyStateByFilter = {
	"required-by": {
		description: "No authored item directly inputs or positively requires this item.",
		title: "Nothing requires this item",
	},
	inputs: {
		description:
			"No authored operation owned by this item directly inputs or positively requires another item.",
		title: "This item has no inputs",
	},
	produces: {
		description: "No authored operation owned by this item outputs another item.",
		title: "This item produces nothing",
	},
} as const satisfies Record<
	ItemConnectionFilter,
	{
		readonly description: string;
		readonly title: string;
	}
>;

interface ConnectionsSectionProps {
	readonly filter: ItemConnectionFilter;
	readonly itemId: string;
	readonly onFilterChangeFn: (filter: ItemConnectionFilter) => void;
}

/** Explores one explicit authored connection projection for any project item. */
export const ConnectionsSection = ({
	filter,
	itemId,
	onFilterChangeFn,
}: ConnectionsSectionProps) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const connectionItems = useMemo(
		() => readItemConnectionsFn(project.config, itemId, filter),
		[
			filter,
			itemId,
			project.config,
		],
	);
	const searchScope = `${itemId}:${filter}`;
	const [searchSelection, setSearchSelectionFn] = useState({
		itemId: "",
		scope: searchScope,
	});
	const selectedConnectionId =
		searchSelection.scope === searchScope &&
		connectionItems.some((item) => item.id === searchSelection.itemId)
			? searchSelection.itemId
			: "";
	const searchOptions = useMemo(
		() =>
			connectionItems.map(
				(item) =>
					({
						id: item.id,
						label: item.title,
						meta: item.id,
						terms: [
							item.id,
							item.title,
							item.description ?? "",
						],
					}) satisfies EditorSearchOption,
			),
		[
			connectionItems,
		],
	);
	const visibleConnectionItems =
		selectedConnectionId.length === 0
			? connectionItems
			: connectionItems.filter((item) => item.id === selectedConnectionId);
	const emptyState = EmptyStateByFilter[filter];

	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemConnections"
		>
			<EditorRootCard dataUi="EditorItemConnectionsControls">
				<div className="flex min-w-0 items-end gap-3">
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							displaySelectedLabel
							emptyLabel={translator.textFn("Connection search empty")}
							key={searchScope}
							label={translator.textFn("Item")}
							labelVisible={false}
							onChangeFn={(nextItemId) =>
								setSearchSelectionFn({
									itemId: nextItemId,
									scope: searchScope,
								})
							}
							onInputChangeFn={(query) => {
								if (query.length > 0) return;
								setSearchSelectionFn({
									itemId: "",
									scope: searchScope,
								});
							}}
							options={searchOptions}
							placeholder={translator.textFn("Connection search placeholder")}
							renderPreviewFn={(option) => (
								<EditorItemSearchThumbnail item={project.config.items[option.id]} />
							)}
							renderSelectedPreviewFn={(option) => (
								<EditorItemSearchThumbnail
									item={
										option === undefined
											? undefined
											: project.config.items[option.id]
									}
									selected
								/>
							)}
							value={selectedConnectionId}
						/>
					</div>
					<EditorSelect
						label={translator.textFn("Connection type")}
						onChangeFn={onFilterChangeFn}
						options={ConnectionFilterOptions.map((option) => ({
							...option,
							label: translator.textFn(option.label),
						}))}
						size="control"
						value={filter}
					/>
				</div>
			</EditorRootCard>

			{connectionItems.length === 0 ? (
				<Status
					dataUi="EditorItemConnectionsEmpty"
					icon={Unlink}
					title={
						<span className="inline-flex items-center gap-1.5">
							{translator.textFn(emptyState.title)}
							<EditorInfoTooltip
								content={translator.textFn(emptyState.description)}
							/>
						</span>
					}
				/>
			) : (
				<section
					className="ak-list grid gap-2"
					data-ui="EditorItemConnectionsList"
				>
					{visibleConnectionItems.map((item) => (
						<article
							className="ak-list-row ak-list-row-interactive relative flex min-h-16 min-w-0 items-center gap-4 rounded-xl p-3"
							data-ui="EditorItemConnectionsRow"
							key={item.id}
						>
							<DetailReference
								itemId={item.id}
								search={{
									filter,
								}}
								sectionId="connections"
								stretched
							/>
							<ChevronRight className="pointer-events-none relative z-10 size-5 shrink-0 text-subtle" />
						</article>
					))}
				</section>
			)}
		</div>
	);
};
