import { PackageOpen, Plus } from "lucide-react";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useMemo } from "react";

import { searchEditorItemsFn } from "~/item-authoring/fn/searchEditorItemsFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorItemListRow } from "~/item-authoring/ui/EditorItemListRow";
import { Status } from "~/ui/status/Status";

/** Lists the canonical saved item registry as the editor's default workspace. */
export const EditorItemList = ({
	itemType,
	onItemTypeChange,
	onQueryChange,
	query,
}: {
	readonly itemType?: TypeSchema.Type;
	readonly onItemTypeChange: (itemType: TypeSchema.Type | undefined) => void;
	readonly onQueryChange: (query: string) => void;
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
	const filteredItems = useMemo(
		() =>
			searchEditorItemsFn(
				items.filter((item) => itemType === undefined || item.type === itemType),
				query,
			),
		[
			itemType,
			items,
			query,
		],
	);
	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			data-scroll-restoration-id="editor-item-list"
			data-ui="EditorItemList"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-2 p-3">
				<EditorHistoryBackButton to="/editor/welcome" />
				<input
					type="search"
					value={query}
					className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search item title, ID or type…"
					onChange={(event) => onQueryChange(event.currentTarget.value)}
				/>
				{itemType === undefined ? null : (
					<button
						type="button"
						className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface-raised px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-foreground"
						data-ui="EditorItemTypeFilter"
						onClick={() => onItemTypeChange(undefined)}
					>
						{itemType}
						<span>×</span>
					</button>
				)}
				{empty ? null : (
					<PrimaryButtonLink
						to="/editor/$projectId/editor/items/new/select"
						params={{
							projectId: project.projectId,
						}}
						className="h-12 min-h-0 shrink-0 gap-2 px-4 text-sm"
					>
						<Plus className="size-4" />
						New item
					</PrimaryButtonLink>
				)}
			</header>
			<div className="ak-list grid content-start gap-2 px-3 pt-3 pb-3">
				{empty ? (
					<Status
						dataUi="EditorItemsEmpty"
						description="Create the first item to start authoring this game."
						icon={PackageOpen}
						title="No items yet"
						action={
							<PrimaryButtonLink
								to="/editor/$projectId/editor/items/new/select"
								params={{
									projectId: project.projectId,
								}}
								className="gap-2"
							>
								<Plus className="size-4" />
								New item
							</PrimaryButtonLink>
						}
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
					<EditorItemListRow
						key={item.uid}
						activeType={itemType}
						item={item}
						onSelectType={onItemTypeChange}
						projectId={project.projectId}
					/>
				))}
			</div>
		</section>
	);
};
