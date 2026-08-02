import { useMemo, useState } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useFuseSearch } from "~/ui/search/useFuseSearch";
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
	const searchCandidates = useMemo(
		() =>
			items
				.filter((item) => itemType === undefined || item.type === itemType)
				.map((item) => ({
					identity: item.uid,
					terms: [
						item.id,
						item.title,
						item.description,
						item.type,
						...item.tags,
					],
				})),
		[
			itemType,
			items,
		],
	);
	const matchingItemUids = useFuseSearch(searchCandidates, query);
	const itemsByUid = useMemo(
		() =>
			new Map(
				items.map((item) => [
					item.uid,
					item,
				]),
			),
		[
			items,
		],
	);
	const empty = items.length === 0;
	const filteredItems = matchingItemUids.flatMap((uid) => {
		const item = itemsByUid.get(uid);
		return item === undefined
			? []
			: [
					item,
				];
	});
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
			aria-label="Items"
			data-ui="EditorItemList"
		>
			<header className="flex min-w-0 flex-wrap items-center gap-2">
				<input
					type="search"
					value={query}
					className="min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search item title, ID, type or tag…"
					aria-label="Search items"
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
				{itemType === undefined ? null : (
					<button
						type="button"
						className="inline-flex min-h-[var(--ak-control-min-height)] cursor-pointer items-center gap-2 rounded-full bg-accent px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wider text-accent-contrast hover:bg-accent-hover"
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
						className="min-h-0 shrink-0 gap-2 px-4 py-3 text-sm"
					>
						<span className="icon-[lucide--plus] size-4" />
						New item
					</PrimaryButtonLink>
				)}
			</header>
			<div className="ak-list grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain pr-1">
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
					<article
						key={item.uid}
						className="ak-list-row flex min-w-0 items-center gap-2 rounded-xl p-1"
						data-item-id={item.id}
						data-item-uid={item.uid}
						data-ui="EditorItemRow"
					>
						<ButtonLink
							to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
							params={{
								projectId: project.projectId,
								itemUid: item.uid,
								sectionId: "identity",
							}}
							className="min-h-0 min-w-0 flex-1 justify-start gap-4 border-0 bg-transparent p-2 text-left shadow-none hover:bg-surface-raised"
						>
							<EditorItemThumbnail resourceIds={item.asset.default} />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-base font-semibold">
									{item.title}
								</span>
								<span className="mt-1 block truncate text-xs text-subtle">
									{item.id}
								</span>
							</span>
						</ButtonLink>
						<button
							type="button"
							className="shrink-0 cursor-pointer rounded-full bg-surface-raised px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-accent hover:text-accent-contrast"
							aria-label={`Filter items by ${item.type}`}
							aria-pressed={itemType === item.type}
							onClick={() => setItemType(item.type)}
						>
							{item.type}
						</button>
					</article>
				))}
			</div>
		</section>
	);
};
