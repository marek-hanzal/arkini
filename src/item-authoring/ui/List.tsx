import { FilePenLine, PackageOpen, Plus } from "lucide-react";
import { useMemo } from "react";

import { filterFn } from "~/item-authoring/fn/filterFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemTypeMenu } from "~/item-authoring/ui/ItemTypeMenu";
import { ListRow } from "~/item-authoring/ui/ListRow";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Lists the canonical saved item registry as the editor's default workspace. */
export const List = ({
	draft,
	itemType,
	onDraftChangeFn,
	onItemTypeChangeFn,
	onQueryChangeFn,
	query,
}: {
	readonly draft: boolean;
	readonly itemType?: TypeSchema.Type;
	readonly onDraftChangeFn: (draft: boolean) => void;
	readonly onItemTypeChangeFn: (itemType: TypeSchema.Type | undefined) => void;
	readonly onQueryChangeFn: (query: string) => void;
	readonly query: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
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
			filterFn(items, {
				draft,
				itemType,
				query,
			}),
		[
			draft,
			itemType,
			items,
			query,
		],
	);
	const newItemMenu = (
		<ItemTypeMenu
			dataUi="EditorNewItemMenu"
			defaultDraft={false}
			description="Choose the item type to start authoring."
			icon={Plus}
			label="New item"
			projectId={project.projectId}
			triggerClassName={empty ? "gap-2" : "h-12 min-h-0 shrink-0 gap-2 px-4 text-sm"}
			types={TypeSchema.options}
			variant="primary"
		/>
	);
	const DraftFilterButton = draft ? PrimaryButton : Button;
	return (
		<EditorSectionPage
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton to="/editor/welcome" />
					<SearchInput
						value={query}
						containerClassName="min-w-64 flex-1"
						className="h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
						placeholder={`${translator.textFn("Search item title, ID or type…")} (${filteredItems.length})`}
						onValueChangeFn={onQueryChangeFn}
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
					<DraftFilterButton
						className="h-12 min-h-0 shrink-0 gap-2 px-4 text-sm"
						onClick={() => onDraftChangeFn(!draft)}
						{...readDataUiFn({
							dataUi: "EditorItemDraftFilter",
							state: {
								selected: draft,
							},
						})}
					>
						<FilePenLine className="size-4" />
						Draft
					</DraftFilterButton>
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
						No items match the active filters.
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
