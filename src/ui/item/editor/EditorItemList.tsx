import { useMemo, useState } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { searchEditorItemsFx } from "~/editor/searchEditorItemsFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { PrimaryButtonLink } from "~/ui/button/Button";
import { EditorItemListRow } from "~/ui/item/editor/EditorItemListRow";
import { Status } from "~/ui/status/Status";

type EditorItemType = NonNullable<EditorProject["config"]>["items"][string]["type"];

/** Lists the canonical saved item registry as the editor's default workspace. */
export const EditorItemList = () => {
	const project = useEditorProject();
	const [query, setQuery] = useState("");
	const [itemType, setItemType] = useState<EditorItemType>();
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
			RendererRuntime.runSync(
				searchEditorItemsFx(
					items.filter((item) => itemType === undefined || item.type === itemType),
					query,
				),
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
			aria-label="Items"
			data-ui="EditorItemList"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-2 p-3">
				<input
					type="search"
					value={query}
					className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search item title, ID or type…"
					aria-label="Search items"
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
				{itemType === undefined ? null : (
					<button
						type="button"
						className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface-raised px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-foreground"
						aria-label={`Clear ${itemType} item filter`}
						data-ui="EditorItemTypeFilter"
						aria-pressed="true"
						onClick={() => setItemType(undefined)}
					>
						{itemType}
						<span aria-hidden="true">×</span>
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
						<span className="icon-[lucide--plus] size-4" />
						New item
					</PrimaryButtonLink>
				)}
			</header>
			<div className="ak-list grid content-start gap-2 px-3 pt-3 pb-3">
				{empty ? (
					<Status
						dataUi="EditorItemsEmpty"
						description="Create the first item to start authoring this game."
						icon="icon-[lucide--package-open]"
						title="No items yet"
						action={
							<PrimaryButtonLink
								to="/editor/$projectId/editor/items/new/select"
								params={{
									projectId: project.projectId,
								}}
								className="gap-2"
							>
								<span className="icon-[lucide--plus] size-4" />
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
						onSelectType={setItemType}
						projectId={project.projectId}
					/>
				))}
			</div>
		</section>
	);
};
