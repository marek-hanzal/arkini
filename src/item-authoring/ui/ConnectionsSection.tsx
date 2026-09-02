import { ChevronRight, Unlink } from "lucide-react";
import { useMemo } from "react";

import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorSelect } from "~/editor-control/ui/EditorSelect";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import { readItemConnectionsFn } from "~/item-authoring/fn/readItemConnectionsFn";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
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
	readonly onItemIdChangeFn: (itemId: string) => void;
}

/** Explores one explicit authored connection projection for any project item. */
export const ConnectionsSection = ({
	filter,
	itemId,
	onFilterChangeFn,
	onItemIdChangeFn,
}: ConnectionsSectionProps) => {
	const project = useEditorProject();
	const connectionItems = useMemo(
		() => readItemConnectionsFn(project.config, itemId, filter),
		[
			filter,
			itemId,
			project.config,
		],
	);
	const emptyState = EmptyStateByFilter[filter];

	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemConnections"
		>
			<EditorRootCard dataUi="EditorItemConnectionsControls">
				<div className="flex min-w-0 items-end gap-3">
					<div className="min-w-0 flex-1">
						<EditorItemReferenceControl
							label="Item"
							onChangeFn={onItemIdChangeFn}
							value={itemId}
						/>
					</div>
					<EditorSelect
						label="Connection type"
						onChangeFn={onFilterChangeFn}
						options={ConnectionFilterOptions}
						value={filter}
					/>
				</div>
			</EditorRootCard>

			{connectionItems.length === 0 ? (
				<Status
					dataUi="EditorItemConnectionsEmpty"
					description={emptyState.description}
					icon={Unlink}
					title={emptyState.title}
				/>
			) : (
				<section
					className="ak-list grid gap-2"
					data-ui="EditorItemConnectionsList"
				>
					{connectionItems.map((item) => (
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
