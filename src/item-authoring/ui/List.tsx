import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import {
	EditorSectionBar,
	EditorSectionShortcutNavigation,
} from "~/authoring-shell/ui/EditorSectionBar";
import { Mx } from "~/translation/ui/Mx";
import { ArrowDownAZ, NotebookPen, PackageOpen, Plus, SearchX } from "lucide-react";
import { useCallback, useMemo } from "react";
import { EditorVirtualCollection } from "~/editor-control/ui/EditorVirtualCollection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ArtworkCardLink } from "~/ui/ui/ArtworkCardLink";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Tooltip } from "~/ui/ui/Tooltip";

const readItemKeyFn = (item: ItemSchema.Type) => item.uid;

/** Lists the canonical saved item registry as the editor's default workspace. */
export const List = ({
	onQueryChangeFn,
	onViewChangeFn,
	query,
	view,
}: {
	readonly onQueryChangeFn: (query: string) => void;
	readonly query: string;
	readonly view: selectItemCollectionFn.View;
	readonly onViewChangeFn: (view: selectItemCollectionFn.View) => void;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const notes = useProjectNotes(project.projectId);
	const notedItemUids = useMemo(
		() => new Set(notes.notes.flatMap((note) => note.itemUids)),
		[
			notes.notes,
		],
	);
	const itemViewOptions = [
		{
			icon: ArrowDownAZ,
			label: translator.textFn("Name"),
			value: "name",
			shortcut: "a",
		},
		{
			icon: NotebookPen,
			label: translator.textFn("With note"),
			value: "with-note",
			shortcut: "w",
		},
	] as const satisfies ReadonlyArray<{
		readonly icon: typeof ArrowDownAZ;
		readonly label: string;
		readonly shortcut: string;
		readonly value: selectItemCollectionFn.View;
	}>;

	const settledQuery = useDebouncedSearchQuery(query);
	const items = useMemo(
		() => Object.values(project.config.items),
		[
			project.config?.items,
		],
	);
	const empty = items.length === 0;
	const filteredItems = useMemo(
		() =>
			selectItemCollectionFn({
				items,
				notedItemUids,
				query: settledQuery,
				view,
			}),
		[
			items,
			settledQuery,
			notedItemUids,
			view,
		],
	);
	const renderItemFn = useCallback(
		(item: ItemSchema.Type) => (
			<ArtworkCardLink
				to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				params={{
					projectId: project.projectId,
					itemUid: item.uid,
					sectionId: "identity",
				}}
				preload="intent"
				data-ui="EditorItemCard"
				data-item-uid={item.uid}
				label={item.title}
				corner={
					notedItemUids.has(item.uid) ? (
						<span title={translator.textFn("Notes")}>
							<NotebookPen className="size-5 text-accent" />
						</span>
					) : undefined
				}
				artwork={
					<EditorItemThumbnail
						className="aspect-square h-auto w-66 max-w-full rounded-none border-0 bg-transparent"
						resourceUids={item.artwork.default}
					/>
				}
			/>
		),
		[
			project.projectId,
			notedItemUids,
			translator,
		],
	);
	const newItemMenu = (
		<Tooltip
			content={`${translator.textFn("New item")} · ${formatForDisplay({
				key: "n",
			})}`}
			placement="bottom"
		>
			<CreateItemLink
				dataUi="EditorNewItemMenu"
				projectId={project.projectId}
				shortcut="n"
				className="h-10 min-h-10 shrink-0 gap-2 px-3 py-2 text-sm"
				variant="primary"
			>
				<Plus className="size-4" />
				{translator.textFn("New item")}
			</CreateItemLink>
		</Tooltip>
	);
	return (
		<EditorSectionPage
			fillContent={filteredItems.length === 0}
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton to="/serapacks" />
					<SearchInput
						value={query}
						containerClassName="min-w-64 flex-1"
						className="h-10 min-h-10 w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-foreground outline-none placeholder:text-muted"
						placeholder={`${translator.textFn("Search items…")} (${filteredItems.length})`}
						onValueChangeFn={onQueryChangeFn}
					/>
					{empty ? null : newItemMenu}
				</header>
			}
			secondaryNavigation={
				<EditorSectionBar
					help={
						<EditorPageHelp
							title={translator.textFn("Items")}
							content={<Mx label="Item list help" />}
						/>
					}
				>
					<EditorSectionShortcutNavigation
						dataUi="EditorItemView"
						onChangeFn={onViewChangeFn}
						options={itemViewOptions}
						value={view}
					/>
				</EditorSectionBar>
			}
			scrollRestorationId="editor-item-list"
		>
			<div
				className="ak-list flex flex-1 flex-col gap-2"
				data-ui="EditorItemList"
			>
				{empty ? (
					<Status
						dataUi="EditorItemsEmpty"
						icon={PackageOpen}
						title={translator.textFn("No items yet")}
						description={translator.textFn(
							"Create the first item to start authoring this game.",
						)}
						size="large"
						variant="flat"
						action={newItemMenu}
					/>
				) : null}
				{view === "with-note" && notes.loading ? (
					<p className="text-sm text-muted">{translator.textFn("Loading notes…")}</p>
				) : null}
				{!empty && filteredItems.length === 0 && (view !== "with-note" || notes.loaded) ? (
					<Status
						dataUi="EditorItemSearchEmpty"
						icon={SearchX}
						title={translator.textFn("No matching items")}
						description={translator.textFn(
							"Try a different search or change the active filters.",
						)}
						size="large"
						variant="flat"
					/>
				) : null}
				{filteredItems.length === 0 ? null : (
					<EditorVirtualCollection
						items={filteredItems}
						itemKeyFn={readItemKeyFn}
						renderItemFn={renderItemFn}
						estimatedRowHeight={352}
						gapRem={0.75}
						minColumnWidthRem={19}
					/>
				)}
			</div>
		</EditorSectionPage>
	);
};
