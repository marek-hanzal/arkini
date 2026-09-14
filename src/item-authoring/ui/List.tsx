import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { FilePenLine, NotebookPen, PackageOpen, Plus, SearchX, TriangleAlert } from "lucide-react";
import { useCallback, useMemo } from "react";
import { EditorVirtualCollection } from "~/editor-control/ui/EditorVirtualCollection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import { EditorSelect, type EditorSelectOption } from "~/editor-control/ui/EditorSelect";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ItemEstimateMetrics } from "~/estimate/ui/ItemEstimateMetrics";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import { ArtworkCardLink } from "~/ui/ui/ArtworkCardLink";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Button } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

const readItemKeyFn = (item: ItemSchema.Type) => item.uid;

/** Lists the canonical saved item registry as the editor's default workspace. */
export const List = ({
	draft,
	onDraftChangeFn,
	onQueryChangeFn,
	onViewChangeFn,
	query,
	view,
}: {
	readonly draft: boolean;
	readonly onDraftChangeFn: (draft: boolean) => void;
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
			label: translator.textFn("Name"),
			value: "name",
		},
		{
			label: translator.textFn("Fastest first"),
			value: "fastest",
		},
		{
			label: translator.textFn("Slowest first"),
			value: "slowest",
		},
		{
			label: translator.textFn("Highest demand first"),
			value: "demand",
		},
		{
			label: translator.textFn("Unreachable"),
			value: "incomplete",
		},
		{
			label: translator.textFn("With note"),
			value: "with-note",
		},
	] as const satisfies ReadonlyArray<EditorSelectOption<selectItemCollectionFn.View>>;

	const settledQuery = useDebouncedSearchQuery(query);
	const estimates = useItemEstimateIndex(project, {
		query: "",
		view: view === "name" || view === "with-note" ? "fastest" : view,
	});
	const estimatesCurrent = estimates.snapshot.config === project.config;
	// Item editing stays live; estimates belong to the captured entry config.
	const currentEstimateRows = useMemo(
		() => (estimatesCurrent ? estimates.rows : []),
		[
			estimates.rows,
			estimatesCurrent,
		],
	);
	const estimatesByUid = useMemo(
		() =>
			new Map(
				currentEstimateRows.map(({ item, estimate }) => [
					item.uid,
					estimate,
				]),
			),
		[
			currentEstimateRows,
		],
	);
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
				orderedEstimates: currentEstimateRows,
				notedItemUids,
				draft,
				query: settledQuery,
				view,
			}),
		[
			draft,
			items,
			settledQuery,
			currentEstimateRows,
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
				className="data-[ui-highlighted=true]:bg-accent/10 data-[ui-highlighted=true]:hover:bg-accent/15"
				{...readDataUiFn({
					dataUi: "EditorItemCard",
					state: {
						draft: readDraftFn(item),
						highlighted:
							readDraftFn(item) ||
							estimatesByUid.get(item.uid)?.status === "unreachable",
					},
				})}
				data-item-id={item.id}
				data-item-uid={item.uid}
				label={item.title}
				corner={
					notedItemUids.has(item.uid) ? (
						<span title={translator.textFn("Notes")}>
							<NotebookPen className="size-5 text-accent" />
						</span>
					) : undefined
				}
				cornerEnd={
					readDraftFn(item) ? (
						<span className="rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
							{translator.textFn("Draft")}
						</span>
					) : undefined
				}
				details={
					<ItemEstimateMetrics
						estimate={estimatesByUid.get(item.uid)}
						maximumDemand={estimates.maximumDemand}
					/>
				}
				artwork={
					<EditorItemThumbnail
						className="aspect-square h-auto w-66 max-w-full rounded-none border-0 bg-transparent"
						resourceIds={item.asset.default}
					/>
				}
			/>
		),
		[
			project.projectId,
			estimatesByUid,
			estimates.maximumDemand,
			notedItemUids,
			translator,
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
	return (
		<EditorSectionPage
			fillContent={filteredItems.length === 0}
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
					<EditorSelect
						label={translator.textFn("View items")}
						onChangeFn={onViewChangeFn}
						options={itemViewOptions}
						value={view}
					/>
					<Button
						className="h-12 min-h-0 shrink-0 gap-2 px-4 text-sm data-[ui-selected=true]:hover:border-accent/35 data-[ui-selected=true]:bg-accent/10 data-[ui-selected=true]:text-accent data-[ui-selected=true]:hover:bg-accent/15 data-[ui-selected=true]:active:bg-accent/15"
						onClick={() => onDraftChangeFn(!draft)}
						{...readDataUiFn({
							dataUi: "EditorItemDraftFilter",
							state: {
								selected: draft,
							},
						})}
					>
						<FilePenLine className="size-4" />
						{translator.textFn("Draft")}
					</Button>
					{empty ? null : newItemMenu}
					<EditorPageHelp
						title={translator.textFn("Items")}
						content={<Mx label="Item list help" />}
					/>
				</header>
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
				{!empty && !estimatesCurrent ? (
					<p className="text-sm text-muted">
						{translator.textFn(
							"Estimates are out of date. Reopen Items to refresh them.",
						)}
					</p>
				) : null}
				{!empty && estimatesCurrent && estimates.status === "loading" ? (
					<p className="text-sm text-muted">
						{translator.textFn("Calculating all item estimates")}
					</p>
				) : null}
				{!empty && estimatesCurrent && estimates.status === "error" ? (
					<Status
						dataUi="EditorItemEstimatesError"
						description={estimates.message}
						icon={TriangleAlert}
						title={translator.textFn("Estimate calculation failed")}
					/>
				) : null}
				{!empty &&
				filteredItems.length === 0 &&
				(view !== "with-note" || notes.loaded) &&
				(view !== "incomplete" || (estimatesCurrent && estimates.status === "ready")) ? (
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
