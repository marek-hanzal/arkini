import { createId } from "@paralleldrive/cuid2";
import { PackageOpen, Plus } from "lucide-react";
import { useMemo } from "react";

import { searchFn } from "~/item-authoring/fn/searchFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemTypeMenu } from "~/item-authoring/ui/ItemTypeMenu";
import { ListRow } from "~/item-authoring/ui/ListRow";
import { Status } from "~/ui/ui/Status";

/** Lists the canonical saved item registry as the editor's default workspace. */
export const List = ({
	itemType,
	onItemTypeChangeFn,
	onQueryChangeFn,
	query,
}: {
	readonly itemType?: TypeSchema.Type;
	readonly onItemTypeChangeFn: (itemType: TypeSchema.Type | undefined) => void;
	readonly onQueryChangeFn: (query: string) => void;
	readonly query: string;
}) => {
	const project = useEditorProject();
	const items = useMemo(
		() =>
			Object.values(project.config?.items ?? {}).sort((left, right) =>
				left.title.localeCompare(right.title),
			),
		[
			project.config?.items,
		],
	);
	const empty = items.length === 0;
	const newItemUidByType = useMemo(
		() =>
			Object.fromEntries(
				TypeSchema.options.map((type) => [
					type,
					createId(),
				]),
			) as Record<TypeSchema.Type, string>,
		[],
	);
	const filteredItems = useMemo(
		() =>
			searchFn(
				items.filter((item) => itemType === undefined || item.type === itemType),
				query,
			),
		[
			itemType,
			items,
			query,
		],
	);
	const newItemMenu = (
		<ItemTypeMenu
			dataUi="EditorNewItemMenu"
			description="Choose the item type to start authoring."
			icon={Plus}
			label="New item"
			projectId={project.projectId}
			readItemUidFn={(type) => newItemUidByType[type]}
			triggerClassName={empty ? "gap-2" : "h-12 min-h-0 shrink-0 gap-2 px-4 text-sm"}
			types={TypeSchema.options}
			variant="primary"
		/>
	);
	return (
		<EditorSectionPage
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton to="/editor/welcome" />
					<input
						type="search"
						value={query}
						className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
						placeholder="Search item title, ID or type…"
						onChange={(event) => onQueryChangeFn(event.currentTarget.value)}
					/>
					{itemType === undefined ? null : (
						<button
							type="button"
							className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface-raised px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-foreground"
							data-ui="EditorItemTypeFilter"
							onClick={() => onItemTypeChangeFn(undefined)}
						>
							{itemType}
							<span>×</span>
						</button>
					)}
					{empty ? null : newItemMenu}
				</header>
			}
			scrollRestorationId="editor-item-list"
		>
			<div
				className="ak-list grid content-start gap-2"
				data-ui="EditorItemList"
			>
				{empty ? (
					<Status
						dataUi="EditorItemsEmpty"
						description="Create the first item to start authoring this game."
						icon={PackageOpen}
						title="No items yet"
						action={newItemMenu}
					/>
				) : null}
				{!empty && filteredItems.length === 0 ? (
					<p
						className="rounded-xl border border-line bg-surface/80 p-4 text-sm text-muted"
						data-ui="EditorItemSearchEmpty"
					>
						No items match the current search and type filter.
					</p>
				) : null}
				{filteredItems.map((item) => (
					<ListRow
						key={item.uid}
						activeType={itemType}
						item={item}
						onSelectTypeFn={onItemTypeChangeFn}
						projectId={project.projectId}
					/>
				))}
			</div>
		</EditorSectionPage>
	);
};
