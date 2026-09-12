import { FilePenLine, PackageOpen, Plus } from "lucide-react";
import { useMemo } from "react";

import { filterFn } from "~/item-authoring/fn/filterFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";
import { ListRow } from "~/item-authoring/ui/ListRow";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Lists the canonical saved item registry as the editor's default workspace. */
export const List = ({
	draft,
	onDraftChangeFn,
	onQueryChangeFn,
	query,
}: {
	readonly draft: boolean;
	readonly onDraftChangeFn: (draft: boolean) => void;
	readonly onQueryChangeFn: (query: string) => void;
	readonly query: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const settledQuery = useDebouncedSearchQuery(query);
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
				query: settledQuery,
			}),
		[
			draft,
			items,
			settledQuery,
		],
	);
	const rows = useMemo(
		() =>
			filteredItems.map((item) => (
				<ListRow
					key={item.uid}
					item={item}
					projectId={project.projectId}
				/>
			)),
		[
			filteredItems,
			project.projectId,
		],
	);
	const newItemMenu = (
		<CreateItemLink
			dataUi="EditorNewItemMenu"
			defaultDraft={false}
			projectId={project.projectId}
			className={empty ? "gap-2" : "h-12 min-h-0 shrink-0 gap-2 px-4 text-sm"}
			variant="primary"
		>
			<Plus className="size-4" />
			{translator.textFn("New item")}
		</CreateItemLink>
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
						placeholder={`${translator.textFn("Search item title or ID…")} (${filteredItems.length})`}
						onValueChangeFn={onQueryChangeFn}
					/>
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
				{rows}
			</div>
		</EditorSectionPage>
	);
};
