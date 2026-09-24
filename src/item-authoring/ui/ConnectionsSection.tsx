import { readItemSearchTermsFn } from "~/item-definition/fn/readItemSearchTermsFn";
import { useMemo, useState } from "react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import {
	EditorSearchCombobox,
	type EditorSearchOption,
} from "~/editor-control/ui/EditorSearchCombobox";
import { EditorSelect } from "~/editor-control/ui/EditorSelect";
import type { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";
import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";
import { readItemConnectionCountsFn } from "~/graph/fn/readItemConnectionCountsFn";
import { useEditorGraphQuery } from "~/graph/ui/useEditorGraphQuery";
import { GraphQueryResult } from "~/graph/ui/GraphQueryResult";
import { useTranslator } from "~/translation/ui/useTranslator";

const Filters = [
	{
		label: "All relationships",
		value: "all",
	},
	{
		label: "Merges into",
		value: "merges-into",
	},
	{
		label: "Accepts merge from",
		value: "accepts-merge",
	},
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
	{
		label: "Rule references",
		value: "references",
	},
	{
		label: "Referenced by rules",
		value: "referenced-by",
	},
] as const;

/** Direct role queries and an optional counterpart use the same worker snapshot as Chain. */
export const ConnectionsSection = ({
	filter,
	itemUid,
	onFilterChangeFn,
}: {
	readonly filter: ItemConnectionFilterSchema.Type;
	readonly itemUid: string;
	readonly onFilterChangeFn: (filter: ItemConnectionFilterSchema.Type) => void;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const [selection, setSelectionFn] = useState({
		itemUid,
		nodeId: "",
	});
	const counterpart = selection.itemUid === itemUid ? selection.nodeId : "";
	const countQuery = useMemo(
		() => ({
			...readItemConnectionQueryFn(itemUid, "all", counterpart || undefined),
			detail: "summary" as const,
			limit: 1000,
		}),
		[
			itemUid,
			counterpart,
		],
	);
	const countState = useEditorGraphQuery(countQuery);
	const counts = useMemo(
		() =>
			countState.status === "ready"
				? readItemConnectionCountsFn(itemUid, countState.result.edges)
				: undefined,
		[
			itemUid,
			countState,
		],
	);
	const query = useMemo(
		() => readItemConnectionQueryFn(itemUid, filter, counterpart || undefined),
		[
			itemUid,
			filter,
			counterpart,
		],
	);
	const state = useEditorGraphQuery(query);
	const countLabelFn = (category: ItemConnectionFilterSchema.Type): string => {
		// A complete selected query is exact even when the broader count query is partial.
		if (category === filter && state.status === "ready" && !state.result.truncated)
			return String(state.result.edges.length);
		if (countState.status === "ready" && counts !== undefined) {
			const count =
				category === filter && state.status === "ready"
					? Math.max(counts[category], state.result.edges.length)
					: counts[category];
			return `${countState.result.truncated ? "≥" : ""}${count}`;
		}
		if (category === filter && state.status === "ready") return `≥${state.result.edges.length}`;
		return countState.status === "loading" ? "…" : "—";
	};
	const searchOptions = useMemo(() => {
		const options = new Map<string, EditorSearchOption>();
		for (const item of Object.values(project.config.items))
			options.set(`item:${item.uid}`, {
				id: `item:${item.uid}`,
				label: item.title,
				...readItemSearchTermsFn(item),
			});
		for (const template of project.config.templates ?? [])
			options.set(`template:${template.uid}`, {
				id: `template:${template.uid}`,
				label: `${translator.textFn("Template")} · ${template.title}`,
				terms: [
					template.uid,
					template.title,
				],
			});
		if (state.status === "ready")
			for (const node of state.result.nodes)
				if (!options.has(node.id))
					options.set(node.id, {
						id: node.id,
						label: node.title,
						terms: [
							node.id,
							node.title,
						],
					});
		return [
			...options.values(),
		];
	}, [
		project.config.items,
		project.config.templates,
		state,
		translator,
	]);
	return (
		<div
			className="flex flex-1 flex-col gap-3"
			data-ui="EditorItemConnections"
		>
			<EditorRootCard dataUi="EditorItemConnectionsControls">
				<div className="flex min-w-0 items-end gap-3">
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							label={translator.textFn("Counterpart")}
							labelVisible={false}
							displaySelectedLabel
							placeholder={`${translator.textFn(
								"Choose a counterpart to inspect its relationships…",
							)} (${countLabelFn(filter)})`}
							emptyLabel={translator.textFn("No matching items")}
							value={counterpart}
							options={searchOptions}
							renderPreviewFn={() => null}
							onChangeFn={(nodeId) =>
								setSelectionFn({
									itemUid,
									nodeId,
								})
							}
							onInputChangeFn={(text) => {
								if (text.length === 0)
									setSelectionFn({
										itemUid,
										nodeId: "",
									});
							}}
						/>
					</div>
					<EditorSelect
						label={translator.textFn("Connection type")}
						value={filter}
						onChangeFn={onFilterChangeFn}
						size="control"
						options={Filters.map((option) => ({
							...option,
							label: translator.textFn(option.label),
							trailingLabel: countLabelFn(option.value),
						}))}
					/>
				</div>
			</EditorRootCard>
			<GraphQueryResult state={state} />
		</div>
	);
};
