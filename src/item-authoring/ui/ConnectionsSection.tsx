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
import { useTranslator } from "~/translation/ui/useTranslator";
import { ItemConnectionRow } from "~/item-authoring/ui/ItemConnectionRow";
import { ItemConnectionsEmpty } from "~/item-authoring/ui/ItemConnectionsEmpty";

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
	{
		label: "Produced by",
		value: "produced-by",
	},
] as const;

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
	const connectionsByFilter = useMemo(
		() => ({
			"required-by": readItemConnectionsFn(project.config, itemId, "required-by"),
			inputs: readItemConnectionsFn(project.config, itemId, "inputs"),
			produces: readItemConnectionsFn(project.config, itemId, "produces"),
			"produced-by": readItemConnectionsFn(project.config, itemId, "produced-by"),
		}),
		[
			itemId,
			project.config,
		],
	);
	const connectionItems = connectionsByFilter[filter];
	const searchScope = `${itemId}:${filter}`;
	const [searchSelection, setSearchSelectionFn] = useState({
		itemId: "",
		scope: searchScope,
	});
	const selectedConnectionId =
		searchSelection.scope === searchScope &&
		connectionItems.some(({ item }) => item.id === searchSelection.itemId)
			? searchSelection.itemId
			: "";
	const searchOptions = useMemo(
		() =>
			connectionItems.map(
				({ item }) =>
					({
						id: item.id,
						label: item.title,
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
			: connectionItems.filter(({ item }) => item.id === selectedConnectionId);

	return (
		<div
			className="flex flex-1 flex-col gap-3"
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
							trailingLabel:
								connectionsByFilter[option.value].length === 0
									? translator.textFn("None")
									: String(connectionsByFilter[option.value].length),
						}))}
						size="control"
						value={filter}
					/>
				</div>
			</EditorRootCard>

			{connectionItems.length === 0 ? (
				<ItemConnectionsEmpty
					filter={filter}
					expanded
				/>
			) : (
				<section
					className="ak-list grid gap-2"
					data-ui="EditorItemConnectionsList"
				>
					{visibleConnectionItems.map(({ item, origins }) => (
						<ItemConnectionRow
							key={item.id}
							item={item}
							origins={origins}
							owner={
								filter === "required-by" || filter === "produced-by"
									? item
									: project.config.items[itemId]
							}
						/>
					))}
				</section>
			)}
		</div>
	);
};
